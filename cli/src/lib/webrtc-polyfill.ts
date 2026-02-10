/**
 * Loads a WebRTC polyfill for Node.js environments where RTCPeerConnection
 * is not natively available (e.g., standalone binaries built with pkg).
 *
 * Uses `node-datachannel` to provide RTCPeerConnection, RTCSessionDescription,
 * and RTCIceCandidate on globalThis so PeerJS can use them.
 *
 * Also fakes browser globals (`window`, `navigator`) that PeerJS checks,
 * and patches RTCPeerConnection to normalise the iceServers format
 * (PeerJS sends arrays of URLs, node-datachannel expects a single string).
 *
 * No-ops if WebRTC APIs already exist (e.g., running in Electron).
 */
export async function ensureWebRTC(): Promise<void> {
  if (typeof globalThis.RTCPeerConnection !== 'undefined') {
    return;
  }

  let mod: any;
  try {
    // Use require() so pkg can statically detect and bundle the native addon.
    // Falls back to dynamic import() for ESM environments where require is unavailable.
    try {
      mod = require('node-datachannel/polyfill');
    } catch {
      mod = await import('node-datachannel/polyfill');
    }
  } catch {
    throw new Error(
      'P2P transfers require WebRTC support, which is not available in this environment.\n' +
      'If running via npm, install the WebRTC polyfill: npm install node-datachannel\n' +
      'Alternatively, use the Web UI for P2P transfers.',
    );
  }

  const polyfill = mod.default ?? mod;

  // node-datachannel expects iceServers[].urls to be a single string,
  // but PeerJS sends an array of strings. Wrap the constructor to normalise.
  const OriginalRTC = polyfill.RTCPeerConnection;
  const PatchedRTC = function PatchedRTCPeerConnection(config?: any) {
    if (config?.iceServers) {
      config = {
        ...config,
        iceServers: config.iceServers.map((server: any) => ({
          ...server,
          urls: Array.isArray(server.urls) ? server.urls[0] : server.urls,
        })),
      };
    }
    return new OriginalRTC(config);
  } as any;
  PatchedRTC.prototype = OriginalRTC.prototype;

  globalThis.RTCPeerConnection = PatchedRTC;
  globalThis.RTCSessionDescription = polyfill.RTCSessionDescription;
  globalThis.RTCIceCandidate = polyfill.RTCIceCandidate;

  // PeerJS checks for a browser environment via `window` and `navigator`.
  // Fake just enough so it doesn't bail out.
  if (typeof globalThis.window === 'undefined') {
    (globalThis as any).window = globalThis;
  }
  if (typeof globalThis.navigator === 'undefined') {
    (globalThis as any).navigator = {} as any;
  }
  if (!(globalThis.navigator as any).userAgent) {
    (globalThis.navigator as any).userAgent = 'Node.js (Dropgate CLI; Chrome-compatible WebRTC)';
  }
}

/**
 * Monkey-patches PeerJS's internal `util.supports` so it believes WebRTC
 * is available. Must be called AFTER importing PeerJS.
 */
export function patchPeerJS(peerModule: any): void {
  const util = peerModule.util ?? peerModule.default?.util;
  if (util?.supports) {
    util.supports.browser = true;
    util.supports.webRTC = true;
    util.supports.audioVideo = false;
    util.supports.data = true;
    util.supports.binaryBlob = false;
    util.supports.reliable = true;
  }
}
