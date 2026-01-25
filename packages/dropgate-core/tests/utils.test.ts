import { describe, it, expect } from 'vitest';
import {
  lifetimeToMs,
  parseSemverMajorMinor,
  validatePlainFilename,
  bytesToBase64,
  base64ToBytes,
  arrayBufferToBase64,
  isLocalhostHostname,
  isSecureContextForP2P,
  generateP2PCode,
  isP2PCodeLike,
  parseServerUrl,
  buildBaseUrl,
} from '../src/index.js';
import {
  DropgateError,
  DropgateValidationError,
  DropgateNetworkError,
  DropgateProtocolError,
  DropgateAbortError,
  DropgateTimeoutError,
} from '../src/errors.js';

describe('lifetimeToMs', () => {
  it('converts minutes to milliseconds', () => {
    expect(lifetimeToMs(1, 'minutes')).toBe(60000);
    expect(lifetimeToMs(5, 'minutes')).toBe(300000);
  });

  it('converts hours to milliseconds', () => {
    expect(lifetimeToMs(1, 'hours')).toBe(3600000);
    expect(lifetimeToMs(24, 'hours')).toBe(86400000);
  });

  it('converts days to milliseconds', () => {
    expect(lifetimeToMs(1, 'days')).toBe(86400000);
    expect(lifetimeToMs(7, 'days')).toBe(604800000);
  });

  it('returns 0 for unlimited', () => {
    expect(lifetimeToMs(999, 'unlimited')).toBe(0);
  });

  it('returns 0 for invalid inputs', () => {
    expect(lifetimeToMs(-1, 'hours')).toBe(0);
    expect(lifetimeToMs(NaN, 'hours')).toBe(0);
    expect(lifetimeToMs(1, 'invalid')).toBe(0);
  });
});

describe('parseSemverMajorMinor', () => {
  it('parses valid semver strings', () => {
    expect(parseSemverMajorMinor('2.0.0')).toEqual({ major: 2, minor: 0 });
    expect(parseSemverMajorMinor('1.5.3')).toEqual({ major: 1, minor: 5 });
  });

  it('handles missing parts', () => {
    expect(parseSemverMajorMinor('2')).toEqual({ major: 2, minor: 0 });
    expect(parseSemverMajorMinor('')).toEqual({ major: 0, minor: 0 });
    expect(parseSemverMajorMinor(null)).toEqual({ major: 0, minor: 0 });
    expect(parseSemverMajorMinor(undefined)).toEqual({ major: 0, minor: 0 });
  });
});

describe('validatePlainFilename', () => {
  it('accepts valid filenames', () => {
    expect(() => validatePlainFilename('test.txt')).not.toThrow();
    expect(() => validatePlainFilename('my-file.pdf')).not.toThrow();
    expect(() => validatePlainFilename('document_v2.docx')).not.toThrow();
  });

  it('rejects empty filenames', () => {
    expect(() => validatePlainFilename('')).toThrow(DropgateValidationError);
    expect(() => validatePlainFilename('   ')).toThrow(DropgateValidationError);
  });

  it('rejects filenames with path separators', () => {
    expect(() => validatePlainFilename('../test.txt')).toThrow(DropgateValidationError);
    expect(() => validatePlainFilename('path/to/file.txt')).toThrow(DropgateValidationError);
    expect(() => validatePlainFilename('path\\to\\file.txt')).toThrow(DropgateValidationError);
  });

  it('rejects filenames that are too long', () => {
    const longName = 'a'.repeat(256);
    expect(() => validatePlainFilename(longName)).toThrow(DropgateValidationError);
  });
});

describe('base64 encoding/decoding', () => {
  it('encodes and decodes bytes correctly', () => {
    const original = new Uint8Array([72, 101, 108, 108, 111]); // "Hello"
    const encoded = bytesToBase64(original);
    expect(encoded).toBe('SGVsbG8=');

    const decoded = base64ToBytes(encoded);
    expect(Array.from(decoded)).toEqual(Array.from(original));
  });

  it('handles empty arrays', () => {
    const empty = new Uint8Array([]);
    const encoded = bytesToBase64(empty);
    expect(encoded).toBe('');

    const decoded = base64ToBytes(encoded);
    expect(decoded.length).toBe(0);
  });

  it('encodes ArrayBuffer correctly', () => {
    const buffer = new Uint8Array([72, 101, 108, 108, 111]).buffer;
    const encoded = arrayBufferToBase64(buffer);
    expect(encoded).toBe('SGVsbG8=');
  });
});

describe('P2P utilities', () => {
  describe('isLocalhostHostname', () => {
    it('identifies localhost variants', () => {
      expect(isLocalhostHostname('localhost')).toBe(true);
      expect(isLocalhostHostname('127.0.0.1')).toBe(true);
      expect(isLocalhostHostname('::1')).toBe(true);
      expect(isLocalhostHostname('LOCALHOST')).toBe(true);
    });

    it('rejects non-localhost hostnames', () => {
      expect(isLocalhostHostname('dropgate.link')).toBe(false);
      expect(isLocalhostHostname('192.168.1.1')).toBe(false);
      expect(isLocalhostHostname('')).toBe(false);
    });
  });

  describe('isSecureContextForP2P', () => {
    it('returns true for secure context', () => {
      expect(isSecureContextForP2P('dropgate.link', true)).toBe(true);
    });

    it('returns true for localhost even without secure context', () => {
      expect(isSecureContextForP2P('localhost', false)).toBe(true);
      expect(isSecureContextForP2P('127.0.0.1', false)).toBe(true);
    });

    it('returns false for non-localhost without secure context', () => {
      expect(isSecureContextForP2P('dropgate.link', false)).toBe(false);
    });
  });

  describe('generateP2PCode', () => {
    it('generates codes in correct format', () => {
      const code = generateP2PCode();
      expect(code).toMatch(/^[A-Z]{4}-\d{4}$/);
    });

    it('generates different codes each time', () => {
      const codes = new Set<string>();
      for (let i = 0; i < 10; i++) {
        codes.add(generateP2PCode());
      }
      // With cryptographic randomness, collisions should be extremely rare
      expect(codes.size).toBeGreaterThan(5);
    });
  });

  describe('isP2PCodeLike', () => {
    it('validates correct P2P codes', () => {
      expect(isP2PCodeLike('ABCD-1234')).toBe(true);
      expect(isP2PCodeLike('WXYZ-9876')).toBe(true);
    });

    it('rejects invalid codes', () => {
      expect(isP2PCodeLike('ABC-1234')).toBe(false);  // Too short
      expect(isP2PCodeLike('ABCD-123')).toBe(false);  // Too short
      expect(isP2PCodeLike('abcd-1234')).toBe(false); // Lowercase
      expect(isP2PCodeLike('ABCD1234')).toBe(false);  // No dash
      expect(isP2PCodeLike('')).toBe(false);
    });
  });
});

describe('parseServerUrl', () => {
  it('parses HTTPS URLs correctly', () => {
    const result = parseServerUrl('https://dropgate.link');
    expect(result.host).toBe('dropgate.link');
    expect(result.secure).toBe(true);
    expect(result.port).toBeUndefined();
  });

  it('parses HTTP URLs correctly', () => {
    const result = parseServerUrl('http://localhost:3000');
    expect(result.host).toBe('localhost');
    expect(result.secure).toBe(false);
    expect(result.port).toBe(3000);
  });

  it('defaults to HTTPS when no protocol specified', () => {
    const result = parseServerUrl('dropgate.link');
    expect(result.host).toBe('dropgate.link');
    expect(result.secure).toBe(true);
  });

  it('handles URLs with ports', () => {
    const result = parseServerUrl('https://example.com:8080');
    expect(result.host).toBe('example.com');
    expect(result.port).toBe(8080);
    expect(result.secure).toBe(true);
  });

  it('handles URLs with whitespace', () => {
    const result = parseServerUrl('  https://dropgate.link  ');
    expect(result.host).toBe('dropgate.link');
  });
});

describe('buildBaseUrl', () => {
  it('builds HTTPS URLs correctly', () => {
    const url = buildBaseUrl({ host: 'dropgate.link', secure: true });
    expect(url).toBe('https://dropgate.link');
  });

  it('builds HTTP URLs correctly', () => {
    const url = buildBaseUrl({ host: 'localhost', secure: false });
    expect(url).toBe('http://localhost');
  });

  it('includes port when specified', () => {
    const url = buildBaseUrl({ host: 'localhost', port: 3000, secure: false });
    expect(url).toBe('http://localhost:3000');
  });

  it('defaults to HTTPS when secure is not specified', () => {
    const url = buildBaseUrl({ host: 'dropgate.link' });
    expect(url).toBe('https://dropgate.link');
  });

  it('throws error for missing host', () => {
    expect(() => buildBaseUrl({ host: '' })).toThrow(DropgateValidationError);
    expect(() => buildBaseUrl({ host: undefined as unknown as string })).toThrow(DropgateValidationError);
  });
});

describe('Error classes', () => {
  describe('DropgateError', () => {
    it('creates error with message and default code', () => {
      const err = new DropgateError('Test error');
      expect(err.message).toBe('Test error');
      expect(err.code).toBe('DROPGATE_ERROR');
      expect(err.name).toBe('DropgateError');
    });

    it('creates error with custom code and details', () => {
      const err = new DropgateError('Test error', {
        code: 'CUSTOM_CODE',
        details: { foo: 'bar' },
      });
      expect(err.code).toBe('CUSTOM_CODE');
      expect(err.details).toEqual({ foo: 'bar' });
    });

    it('creates error with cause', () => {
      const cause = new Error('Original error');
      const err = new DropgateError('Wrapped error', { cause });
      expect(err.cause).toBe(cause);
    });
  });

  describe('DropgateValidationError', () => {
    it('creates error with VALIDATION_ERROR code', () => {
      const err = new DropgateValidationError('Invalid input');
      expect(err.message).toBe('Invalid input');
      expect(err.code).toBe('VALIDATION_ERROR');
      expect(err.name).toBe('DropgateValidationError');
    });
  });

  describe('DropgateNetworkError', () => {
    it('creates error with NETWORK_ERROR code', () => {
      const err = new DropgateNetworkError('Connection failed');
      expect(err.message).toBe('Connection failed');
      expect(err.code).toBe('NETWORK_ERROR');
      expect(err.name).toBe('DropgateNetworkError');
    });
  });

  describe('DropgateProtocolError', () => {
    it('creates error with PROTOCOL_ERROR code', () => {
      const err = new DropgateProtocolError('Server returned invalid response');
      expect(err.message).toBe('Server returned invalid response');
      expect(err.code).toBe('PROTOCOL_ERROR');
      expect(err.name).toBe('DropgateProtocolError');
    });
  });

  describe('DropgateAbortError', () => {
    it('creates error with default message', () => {
      const err = new DropgateAbortError();
      expect(err.message).toBe('Operation aborted');
      expect(err.code).toBe('ABORT_ERROR');
      expect(err.name).toBe('AbortError');
    });

    it('creates error with custom message', () => {
      const err = new DropgateAbortError('Upload cancelled');
      expect(err.message).toBe('Upload cancelled');
    });
  });

  describe('DropgateTimeoutError', () => {
    it('creates error with default message', () => {
      const err = new DropgateTimeoutError();
      expect(err.message).toBe('Request timed out');
      expect(err.code).toBe('TIMEOUT_ERROR');
      expect(err.name).toBe('TimeoutError');
    });

    it('creates error with custom message', () => {
      const err = new DropgateTimeoutError('Server did not respond in time');
      expect(err.message).toBe('Server did not respond in time');
    });
  });
});
