import fs from 'node:fs';
import path from 'node:path';
import readline from 'node:readline';
import { isP2PCodeLike } from '@dropgate/core';
import type { ParsedFlags } from '../lib/parse.js';
import { getFlag, getFlagBool, sanitizeFilename } from '../lib/parse.js';
import { createClient } from '../lib/client.js';
import { ProgressRenderer } from '../lib/progress.js';
import { formatBytes, formatDuration, pluralize } from '../lib/format.js';
import {
  printHeader,
  printKeyValue,
  printBlank,
  printSuccess,
  printWarning,
  dim,
  green,
  bold,
  boldCyan,
  isQuiet,
  isJson,
  showCursor,
} from '../lib/output.js';
import { exitUsage, exitError } from '../lib/errors.js';
import { ensureWebRTC, patchPeerJS } from '../lib/webrtc-polyfill.js';

async function promptYesNo(question: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise<boolean>((resolve) => {
    rl.question(`  ${question} ${dim('[Y/n]')} `, (answer) => {
      rl.close();
      const a = answer.trim().toLowerCase();
      resolve(a === '' || a === 'y' || a === 'yes');
    });
  });
}

export async function run(args: string[], flags: ParsedFlags): Promise<void> {
  const code = args[0];
  if (!code) {
    exitUsage('A share code is required (e.g., ABCD-1234).');
  }

  const normalizedCode = code.toUpperCase().trim();
  if (!isP2PCodeLike(normalizedCode)) {
    exitUsage(`Invalid share code format: "${code}". Expected format: ABCD-1234.`);
  }

  // Ensure WebRTC APIs are available (polyfill for Node.js environments)
  try {
    await ensureWebRTC();
  } catch (err: any) {
    exitError(err.message);
  }

  // Load PeerJS (bundled into the CLI build)
  let Peer: any;
  try {
    const peerModule = await import('peerjs');
    patchPeerJS(peerModule);
    Peer = peerModule.Peer ?? peerModule.default?.Peer ?? peerModule.default;
  } catch {
    exitError('PeerJS failed to load.');
  }

  const outputDir = path.resolve(getFlag(flags, 'o', 'output') ?? '.');
  fs.mkdirSync(outputDir, { recursive: true });
  const autoAccept = getFlagBool(flags, 'y', 'yes') === true;

  const client = createClient(flags);
  const compat = await client.connect();
  const quiet = isQuiet();
  const json = isJson();

  if (!quiet && !json) {
    printHeader('Dropgate Receive');
    printKeyValue('Server', `${compat.baseUrl} ${dim(`v${compat.serverInfo.version}`)}`);
    printKeyValue('Code', boldCyan(normalizedCode));
    printBlank();
    console.log(`  ${dim('Connecting to sender...')}`);
  }

  const progress = new ProgressRenderer();
  let currentWriteStream: fs.WriteStream | null = null;
  let currentFilePath: string | null = null;
  const savedFiles: string[] = [];
  let totalReceived = 0;

  return new Promise<void>((resolve, reject) => {
    let session: any;

    // Graceful Ctrl+C
    let cancelCount = 0;
    const sigintHandler = () => {
      cancelCount++;
      if (cancelCount === 1) {
        if (session) session.stop();
        if (currentWriteStream) currentWriteStream.destroy();
        progress.finish();
        printWarning('Transfer cancelled.');
        resolve();
      } else {
        showCursor();
        process.exit(130);
      }
    };
    process.on('SIGINT', sigintHandler);

    const cleanup = () => {
      process.removeListener('SIGINT', sigintHandler);
      if (currentWriteStream) {
        currentWriteStream.end();
        currentWriteStream = null;
      }
    };

    client.p2pReceive({
      code: normalizedCode,
      Peer,
      autoReady: autoAccept,
      onMeta: async (meta: {
        name: string;
        total: number;
        sendReady?: () => void;
        fileCount?: number;
        files?: Array<{ name: string; size: number }>;
        totalSize?: number;
      }) => {
        if (!quiet && !json) {
          printBlank();
          if (meta.fileCount && meta.fileCount > 1 && meta.files) {
            console.log(`  ${bold('Files offered:')} ${meta.fileCount} ${pluralize(meta.fileCount, 'file')} ${dim(`(${formatBytes(meta.totalSize ?? meta.total)} total)`)}`);
            for (const f of meta.files) {
              console.log(`    ${dim('\u2514')} ${f.name} ${dim(`(${formatBytes(f.size)})`)}`);
            }
          } else {
            console.log(`  ${bold('File offered:')} ${meta.name} ${dim(`(${formatBytes(meta.total)})`)}`);
          }
        }

        if (!autoAccept && meta.sendReady) {
          const accepted = await promptYesNo('Accept?');
          if (accepted) {
            meta.sendReady();
            if (!quiet && !json) {
              printBlank();
              console.log(`  ${dim('Receiving...')}`);
              printBlank();
            }
          } else {
            if (session) session.stop();
            cleanup();
            if (!quiet) printWarning('Transfer declined.');
            resolve();
          }
        } else if (!quiet && !json) {
          printBlank();
          console.log(`  ${dim('Receiving...')}`);
          printBlank();
        }
      },
      onFileStart: (evt: { fileIndex: number; name: string; size: number }) => {
        const safeName = sanitizeFilename(evt.name);
        currentFilePath = path.join(outputDir, safeName);
        currentWriteStream = fs.createWriteStream(currentFilePath);
        savedFiles.push(currentFilePath);
      },
      onData: async (chunk: Uint8Array) => {
        if (currentWriteStream) {
          await new Promise<void>((resolve) => {
            const ok = currentWriteStream!.write(Buffer.from(chunk));
            if (ok) resolve();
            else currentWriteStream!.once('drain', resolve);
          });
        } else if (savedFiles.length === 0) {
          // Single-file mode - no onFileStart called
          // The metadata name is used
          // We'll handle this in onComplete with result data
        }
      },
      onFileEnd: (evt: { fileIndex: number; receivedBytes: number }) => {
        totalReceived += evt.receivedBytes;
        if (currentWriteStream) {
          currentWriteStream.end();
          currentWriteStream = null;
        }
      },
      onProgress: (evt: { percent: number; processedBytes: number; totalBytes: number }) => {
        if (!quiet && !json) {
          progress.update(evt);
        }
      },
      onComplete: (evt: { received: number; total: number }) => {
        progress.finish();
        cleanup();

        if (json) {
          console.log(JSON.stringify({
            savedTo: outputDir,
            files: savedFiles.map(f => path.basename(f)),
            filePaths: savedFiles,
            receivedBytes: evt.received,
            elapsed: progress.getElapsedMs(),
          }, null, 2));
          resolve();
          return;
        }

        if (quiet) {
          savedFiles.forEach(f => console.log(f));
          resolve();
          return;
        }

        printBlank();
        printSuccess(`Transfer complete! ${dim(`(${formatDuration(progress.getElapsedMs())})`)}`);
        console.log(`  ${dim('Saved to:')} ${boldCyan(outputDir)} ${dim(`(${formatBytes(evt.received)})`)}`);
        for (const f of savedFiles) {
          console.log(`    ${dim('\u2514')} ${path.basename(f)}`);
        }
        printBlank();
        resolve();
      },
      onError: (err: Error) => {
        progress.finish();
        cleanup();
        reject(err);
      },
      onCancel: (evt: { cancelledBy: string; message?: string }) => {
        progress.finish();
        cleanup();
        if (!quiet) printWarning(`Transfer cancelled by ${evt.cancelledBy}.`);
        resolve();
      },
      onDisconnect: () => {
        progress.finish();
        cleanup();
        if (!quiet) printWarning('Sender disconnected.');
        resolve();
      },
    }).then(s => {
      session = s;
    }).catch(err => {
      cleanup();
      reject(err);
    });
  });
}
