import { DropgateValidationError, DropgateNetworkError } from '../errors.js';
import { sleep } from '../utils/network.js';
import type { P2PReceiveOptions, P2PReceiveSession, P2PReceiveState, DataConnection } from './types.js';
import { isP2PCodeLike } from './utils.js';
import { buildPeerOptions, resolvePeerConfig } from './helpers.js';
import {
  P2P_PROTOCOL_VERSION,
  P2P_END_ACK_RETRY_DELAY_MS,
  isP2PMessage,
  type P2PChunkMessage,
} from './protocol.js';

/**
 * Allowed state transitions to prevent invalid state changes.
 */
const ALLOWED_TRANSITIONS: Record<P2PReceiveState, P2PReceiveState[]> = {
  initializing: ['connecting', 'closed'],
  connecting: ['handshaking', 'closed', 'cancelled'],
  handshaking: ['negotiating', 'closed', 'cancelled'],
  negotiating: ['transferring', 'closed', 'cancelled'],
  transferring: ['completed', 'closed', 'cancelled'],
  completed: ['closed'],
  cancelled: ['closed'],
  closed: [],
};

/**
 * Start a direct transfer (P2P) receiver session.
 *
 * IMPORTANT: Consumer must provide the PeerJS Peer constructor and handle file writing.
 * This removes DOM coupling (no streamSaver).
 *
 * Protocol v2 features:
 * - Explicit version handshake
 * - Chunk-level acknowledgments for flow control
 * - Multiple end-ack sends for reliability
 * - Stream-through design for unlimited file sizes
 *
 * Example:
 * ```js
 * import Peer from 'peerjs';
 * import { startP2PReceive } from '@dropgate/core/p2p';
 *
 * let writer;
 * const session = await startP2PReceive({
 *   code: 'ABCD-1234',
 *   Peer,
 *   host: 'dropgate.link',
 *   secure: true,
 *   onMeta: ({ name, total }) => {
 *     // Consumer creates file writer
 *     writer = createWriteStream(name);
 *   },
 *   onData: async (chunk) => {
 *     // Consumer writes data
 *     await writer.write(chunk);
 *   },
 *   onComplete: () => {
 *     writer.close();
 *     console.log('Done!');
 *   },
 * });
 * ```
 */
export async function startP2PReceive(opts: P2PReceiveOptions): Promise<P2PReceiveSession> {
  const {
    code,
    Peer,
    serverInfo,
    host,
    port,
    peerjsPath,
    secure = false,
    iceServers,
    autoReady = true,
    watchdogTimeoutMs = 15000,
    onStatus,
    onMeta,
    onData,
    onProgress,
    onComplete,
    onError,
    onDisconnect,
    onCancel,
  } = opts;

  // Validate required options
  if (!code) {
    throw new DropgateValidationError('No sharing code was provided.');
  }

  if (!Peer) {
    throw new DropgateValidationError(
      'PeerJS Peer constructor is required. Install peerjs and pass it as the Peer option.'
    );
  }

  // Check P2P capabilities if serverInfo is provided
  const p2pCaps = serverInfo?.capabilities?.p2p;
  if (serverInfo && !p2pCaps?.enabled) {
    throw new DropgateValidationError('Direct transfer is disabled on this server.');
  }

  // Validate and normalize code
  const normalizedCode = String(code).trim().replace(/\s+/g, '').toUpperCase();
  if (!isP2PCodeLike(normalizedCode)) {
    throw new DropgateValidationError('Invalid direct transfer code.');
  }

  // Resolve config from user options and server capabilities
  const { path: finalPath, iceServers: finalIceServers } = resolvePeerConfig(
    { peerjsPath, iceServers },
    p2pCaps
  );

  // Build peer options
  const peerOpts = buildPeerOptions({
    host,
    port,
    peerjsPath: finalPath,
    secure,
    iceServers: finalIceServers,
  });

  // Create peer (receiver doesn't need a specific ID)
  const peer = new Peer(undefined, peerOpts);

  // State machine - replaces boolean flags to prevent race conditions
  let state: P2PReceiveState = 'initializing';
  let total = 0;
  let received = 0;
  let currentSessionId: string | null = null;
  let senderProtocolVersion: number | null = null;
  let lastProgressSentAt = 0;
  const progressIntervalMs = 120;
  let writeQueue = Promise.resolve();
  let watchdogTimer: ReturnType<typeof setTimeout> | null = null;
  let activeConn: DataConnection | null = null;

  // Chunk tracking for v2 protocol
  let pendingChunk: P2PChunkMessage | null = null;

  /**
   * Attempt a state transition. Returns true if transition was valid.
   */
  const transitionTo = (newState: P2PReceiveState): boolean => {
    if (!ALLOWED_TRANSITIONS[state].includes(newState)) {
      console.warn(`[P2P Receive] Invalid state transition: ${state} -> ${newState}`);
      return false;
    }
    state = newState;
    return true;
  };

  // Watchdog - detects dead connections during transfer
  const resetWatchdog = (): void => {
    if (watchdogTimeoutMs <= 0) return;

    if (watchdogTimer) {
      clearTimeout(watchdogTimer);
    }

    watchdogTimer = setTimeout(() => {
      if (state === 'transferring') {
        safeError(new DropgateNetworkError('Connection timed out (no data received).'));
      }
    }, watchdogTimeoutMs);
  };

  const clearWatchdog = (): void => {
    if (watchdogTimer) {
      clearTimeout(watchdogTimer);
      watchdogTimer = null;
    }
  };

  // Safe error handler - prevents calling onError after completion or cancellation
  const safeError = (err: Error): void => {
    if (state === 'closed' || state === 'completed' || state === 'cancelled') return;
    transitionTo('closed');
    onError?.(err);
    cleanup();
  };

  // Safe complete handler - only fires from transferring state
  const safeComplete = (completeData: { received: number; total: number }): void => {
    if (state !== 'transferring') return;
    transitionTo('completed');
    onComplete?.(completeData);
    // Don't immediately cleanup - let acks be sent first
    // The sender will close the connection after receiving ack
    // Our close handler will call cleanup when that happens
  };

  // Cleanup all resources
  const cleanup = (): void => {
    clearWatchdog();

    // Remove beforeunload listener if in browser
    if (typeof window !== 'undefined') {
      window.removeEventListener('beforeunload', handleUnload);
    }

    try {
      peer.destroy();
    } catch {
      // Ignore destroy errors
    }
  };

  // Handle browser tab close/refresh
  const handleUnload = (): void => {
    try {
      activeConn?.send({ t: 'error', message: 'Receiver closed the connection.' });
    } catch {
      // Best effort
    }
    stop();
  };

  // Add beforeunload listener if in browser
  if (typeof window !== 'undefined') {
    window.addEventListener('beforeunload', handleUnload);
  }

  const stop = (): void => {
    if (state === 'closed' || state === 'cancelled') return;

    const wasActive = state === 'transferring';
    transitionTo('cancelled');

    // Notify peer before cleanup
    try {
      // @ts-expect-error - open property may exist on PeerJS connections
      if (activeConn && activeConn.open) {
        activeConn.send({ t: 'cancelled', reason: 'Receiver cancelled the transfer.' });
      }
    } catch {
      // Best effort
    }

    if (wasActive && onCancel) {
      onCancel({ cancelledBy: 'receiver' });
    }

    cleanup();
  };

  // Send chunk acknowledgment (v2 protocol)
  const sendChunkAck = (conn: DataConnection, seq: number): void => {
    if (senderProtocolVersion && senderProtocolVersion >= 2) {
      try {
        conn.send({ t: 'chunk_ack', seq, received });
      } catch {
        // Ignore send errors
      }
    }
  };

  peer.on('error', (err: Error) => {
    safeError(err);
  });

  peer.on('open', () => {
    transitionTo('connecting');
    const conn = peer.connect(normalizedCode, { reliable: true });
    activeConn = conn;

    conn.on('open', () => {
      transitionTo('handshaking');
      onStatus?.({ phase: 'connected', message: 'Connected. Exchanging protocol version...' });

      // Send our hello immediately
      conn.send({
        t: 'hello',
        protocolVersion: P2P_PROTOCOL_VERSION,
        sessionId: '',
      });
    });

    conn.on('data', async (data: unknown) => {
      try {
        // Reset watchdog on any data received
        resetWatchdog();

        // Handle binary data - this is file content
        if (data instanceof ArrayBuffer || ArrayBuffer.isView(data) ||
          (typeof Blob !== 'undefined' && data instanceof Blob)) {

          // Process the binary chunk
          let bufPromise: Promise<Uint8Array>;

          if (data instanceof ArrayBuffer) {
            bufPromise = Promise.resolve(new Uint8Array(data));
          } else if (ArrayBuffer.isView(data)) {
            bufPromise = Promise.resolve(
              new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
            );
          } else if (typeof Blob !== 'undefined' && data instanceof Blob) {
            bufPromise = data.arrayBuffer().then((buffer) => new Uint8Array(buffer));
          } else {
            return;
          }

          // Queue the write operation
          const chunkSeq = pendingChunk?.seq ?? -1;
          pendingChunk = null;

          writeQueue = writeQueue
            .then(async () => {
              const buf = await bufPromise;

              // Call consumer's onData handler (stream-through, no buffering)
              if (onData) {
                await onData(buf);
              }

              received += buf.byteLength;
              const percent = total ? Math.min(100, (received / total) * 100) : 0;
              onProgress?.({ processedBytes: received, totalBytes: total, percent });

              // Send chunk acknowledgment for v2 protocol
              if (chunkSeq >= 0) {
                sendChunkAck(conn, chunkSeq);
              }

              // Send progress updates (for v1 compatibility and UI feedback)
              const now = Date.now();
              if (received === total || now - lastProgressSentAt >= progressIntervalMs) {
                lastProgressSentAt = now;
                try {
                  conn.send({ t: 'progress', received, total });
                } catch {
                  // Ignore send errors
                }
              }
            })
            .catch((err) => {
              try {
                conn.send({
                  t: 'error',
                  message: (err as Error)?.message || 'Receiver write failed.',
                });
              } catch {
                // Ignore send errors
              }
              safeError(err as Error);
            });

          return;
        }

        // Handle control messages
        if (!isP2PMessage(data)) return;

        const msg = data;

        switch (msg.t) {
          case 'hello':
            // Store sender's protocol version
            senderProtocolVersion = msg.protocolVersion;
            currentSessionId = msg.sessionId || null;
            transitionTo('negotiating');
            onStatus?.({ phase: 'waiting', message: 'Waiting for file details...' });
            break;

          case 'meta': {
            // Legacy/fallback: might receive meta before hello from v1 senders
            if (state === 'handshaking') {
              transitionTo('negotiating');
            }

            // Session ID validation - reject if we're busy with a different session
            if (currentSessionId && msg.sessionId && msg.sessionId !== currentSessionId) {
              try {
                conn.send({ t: 'error', message: 'Busy with another session.' });
              } catch {
                // Ignore send errors
              }
              return;
            }

            // Store the session ID for this transfer
            if (msg.sessionId) {
              currentSessionId = msg.sessionId;
            }

            const name = String(msg.name || 'file');
            total = Number(msg.size) || 0;
            received = 0;
            writeQueue = Promise.resolve();

            // Function to send ready signal
            const sendReady = (): void => {
              transitionTo('transferring');
              // Start watchdog once we're ready to receive data
              resetWatchdog();
              try {
                conn.send({ t: 'ready' });
              } catch {
                // Ignore send errors
              }
            };

            if (autoReady) {
              onMeta?.({ name, total });
              onProgress?.({ processedBytes: received, totalBytes: total, percent: 0 });
              sendReady();
            } else {
              // Pass sendReady function to callback so consumer can trigger transfer start
              onMeta?.({ name, total, sendReady });
              onProgress?.({ processedBytes: received, totalBytes: total, percent: 0 });
            }
            break;
          }

          case 'chunk':
            // v2 protocol: chunk header precedes binary data
            pendingChunk = msg as P2PChunkMessage;
            break;

          case 'ping':
            // Respond to heartbeat - keeps watchdog alive and confirms we're active
            try {
              conn.send({ t: 'pong', timestamp: Date.now() });
            } catch {
              // Ignore send errors
            }
            break;

          case 'end':
            clearWatchdog();
            await writeQueue;

            if (total && received < total) {
              const err = new DropgateNetworkError(
                'Transfer ended before the full file was received.'
              );
              try {
                conn.send({ t: 'error', message: err.message });
              } catch {
                // Ignore send errors
              }
              throw err;
            }

            // Send FIRST end_ack immediately so sender can complete
            // Then mark ourselves as complete to protect against close handler race
            // Then send additional acks for reliability (fire-and-forget)
            if (senderProtocolVersion && senderProtocolVersion >= 2) {
              try {
                conn.send({ t: 'end_ack', received, total });
              } catch {
                // Ignore send errors
              }
            } else {
              // v1 fallback: single ack
              try {
                conn.send({ t: 'ack', phase: 'end', received, total });
              } catch {
                // Ignore send errors
              }
            }

            // Now mark as completed - this protects against close handler race
            safeComplete({ received, total });

            // Send additional acks for reliability (fire-and-forget, best effort)
            if (senderProtocolVersion && senderProtocolVersion >= 2) {
              // Send 2 more acks with delays
              (async () => {
                for (let i = 0; i < 2; i++) {
                  await sleep(P2P_END_ACK_RETRY_DELAY_MS);
                  try {
                    conn.send({ t: 'end_ack', received, total });
                  } catch {
                    break; // Connection closed
                  }
                }
              })().catch(() => { });
            }
            break;

          case 'error':
            throw new DropgateNetworkError(msg.message || 'Sender reported an error.');

          case 'cancelled':
            if (state === 'cancelled' || state === 'closed' || state === 'completed') return;
            transitionTo('cancelled');
            onCancel?.({ cancelledBy: 'sender', message: msg.reason });
            cleanup();
            break;
        }
      } catch (err) {
        safeError(err as Error);
      }
    });

    conn.on('close', () => {
      if (state === 'closed' || state === 'completed' || state === 'cancelled') {
        // Clean shutdown or already cancelled, ensure full cleanup
        cleanup();
        return;
      }

      // Sender disconnected or cancelled before transfer completed
      if (state === 'transferring') {
        // Connection closed during active transfer — the sender either cancelled
        // or disconnected. Treat as a sender-initiated cancellation so the UI
        // can show a clean message instead of a raw error.
        transitionTo('cancelled');
        onCancel?.({ cancelledBy: 'sender' });
        cleanup();
      } else if (state === 'negotiating') {
        // We had metadata but transfer hadn't started
        transitionTo('closed');
        cleanup();
        onDisconnect?.();
      } else {
        // Disconnected before we even got file metadata
        safeError(new DropgateNetworkError('Sender disconnected before file details were received.'));
      }
    });
  });

  return {
    peer,
    stop,
    getStatus: () => state,
    getBytesReceived: () => received,
    getTotalBytes: () => total,
    getSessionId: () => currentSessionId,
  };
}
