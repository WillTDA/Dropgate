import type { CryptoAdapter } from '../types.js';
import { arrayBufferToBase64 } from '../utils/base64.js';
import { sha256Fallback } from './sha256-fallback.js';

/**
 * Convert a raw SHA-256 digest ArrayBuffer to a hex string.
 */
function digestToHex(hashBuffer: ArrayBuffer): string {
  const arr = new Uint8Array(hashBuffer);
  let hex = '';
  for (let i = 0; i < arr.length; i++) {
    hex += arr[i].toString(16).padStart(2, '0');
  }
  return hex;
}

/**
 * Compute SHA-256 hash of data and return as hex string.
 *
 * Uses crypto.subtle when available. Falls back to a pure-JS
 * implementation for integrity hashing on insecure contexts.
 * The fallback MUST NOT be used for encryption operations.
 */
export async function sha256Hex(
  cryptoObj: CryptoAdapter,
  data: ArrayBuffer
): Promise<string> {
  if (cryptoObj?.subtle) {
    const hashBuffer = await cryptoObj.subtle.digest('SHA-256', data);
    return digestToHex(hashBuffer);
  }
  // Fallback: pure-JS SHA-256 for integrity verification only
  return digestToHex(sha256Fallback(data));
}

/**
 * Generate a new AES-GCM 256-bit encryption key.
 */
export async function generateAesGcmKey(
  cryptoObj: CryptoAdapter
): Promise<CryptoKey> {
  return cryptoObj.subtle.generateKey(
    { name: 'AES-GCM', length: 256 },
    true,
    ['encrypt', 'decrypt']
  );
}

/**
 * Export a CryptoKey to a base64-encoded raw key.
 */
export async function exportKeyBase64(
  cryptoObj: CryptoAdapter,
  key: CryptoKey
): Promise<string> {
  const raw = await cryptoObj.subtle.exportKey('raw', key);
  return arrayBufferToBase64(raw);
}

// Re-export decryption functions
export { importKeyFromBase64, decryptChunk, decryptFilenameFromBase64 } from './decrypt.js';
