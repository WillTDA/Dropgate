import { describe, it, expect } from 'vitest';
import {
  parseArgs,
  parseDownloadTarget,
  parseLifetime,
  getFlag,
  getFlagBool,
  getFlagArray,
  hasFlag,
  sanitizeFilename,
} from '../src/lib/parse.js';

describe('parseArgs', () => {
  it('parses a simple command', () => {
    const result = parseArgs(['node', 'index.js', 'upload']);
    expect(result.command).toBe('upload');
    expect(result.args).toEqual([]);
    expect(result.flags).toEqual({});
  });

  it('parses command with positional args', () => {
    const result = parseArgs(['node', 'index.js', 'download', 'https://example.com/abc123']);
    expect(result.command).toBe('download');
    expect(result.args).toEqual(['https://example.com/abc123']);
  });

  it('parses long flags with values', () => {
    const result = parseArgs(['node', 'index.js', 'upload', '--server', 'https://example.com']);
    expect(result.command).toBe('upload');
    expect(result.flags.server).toBe('https://example.com');
  });

  it('parses short flags with values', () => {
    const result = parseArgs(['node', 'index.js', 'upload', '-i', 'file.txt']);
    expect(result.command).toBe('upload');
    expect(result.flags.i).toBe('file.txt');
  });

  it('parses boolean flags', () => {
    const result = parseArgs(['node', 'index.js', 'upload', '--json', '--quiet']);
    expect(result.command).toBe('upload');
    expect(result.flags.json).toBe(true);
    expect(result.flags.quiet).toBe(true);
  });

  it('parses negated flags (--no-*)', () => {
    const result = parseArgs(['node', 'index.js', 'upload', '--no-color', '--no-encrypt']);
    expect(result.command).toBe('upload');
    expect(result.flags.color).toBe(false);
    expect(result.flags.encrypt).toBe(false);
  });

  it('parses repeated flags as arrays', () => {
    const result = parseArgs(['node', 'index.js', 'upload', '-i', 'file1.txt', '-i', 'file2.txt']);
    expect(result.command).toBe('upload');
    expect(result.flags.i).toEqual(['file1.txt', 'file2.txt']);
  });

  it('handles -- separator', () => {
    const result = parseArgs(['node', 'index.js', 'download', '--', '--not-a-flag']);
    expect(result.command).toBe('download');
    expect(result.args).toEqual(['--not-a-flag']);
  });

  it('handles no command', () => {
    const result = parseArgs(['node', 'index.js']);
    expect(result.command).toBe('');
    expect(result.args).toEqual([]);
  });

  it('handles flags before command', () => {
    const result = parseArgs(['node', 'index.js', '--server', 'https://example.com', 'upload']);
    expect(result.command).toBe('upload');
    expect(result.flags.server).toBe('https://example.com');
  });

  it('skips boolean global flags before command', () => {
    const result = parseArgs(['node', 'index.js', '--help']);
    expect(result.command).toBe('');
    expect(result.flags.help).toBe(true);
  });

  it('handles --version flag', () => {
    const result = parseArgs(['node', 'index.js', '--version']);
    expect(result.command).toBe('');
    expect(result.flags.version).toBe(true);
  });

  it('parses repeated long flags as arrays', () => {
    const result = parseArgs(['node', 'index.js', 'upload', '--input', 'a.txt', '--input', 'b.txt']);
    expect(result.flags.input).toEqual(['a.txt', 'b.txt']);
  });

  it('handles mixed flags and positional args', () => {
    const result = parseArgs(['node', 'index.js', 'config', 'set', 'server', 'https://example.com']);
    expect(result.command).toBe('config');
    expect(result.args).toEqual(['set', 'server', 'https://example.com']);
  });
});

describe('parseDownloadTarget', () => {
  it('parses a full file URL', () => {
    const result = parseDownloadTarget('https://example.com/abc123#keyBase64');
    expect(result.type).toBe('url-file');
    expect(result.server).toBe('https://example.com');
    expect(result.fileId).toBe('abc123');
    expect(result.keyB64).toBe('keyBase64');
  });

  it('parses a file URL without key', () => {
    const result = parseDownloadTarget('https://example.com/abc123');
    expect(result.type).toBe('url-file');
    expect(result.server).toBe('https://example.com');
    expect(result.fileId).toBe('abc123');
    expect(result.keyB64).toBeUndefined();
  });

  it('parses a bundle URL', () => {
    const result = parseDownloadTarget('https://example.com/b/bundle123#keyBase64');
    expect(result.type).toBe('url-bundle');
    expect(result.server).toBe('https://example.com');
    expect(result.bundleId).toBe('bundle123');
    expect(result.keyB64).toBe('keyBase64');
  });

  it('parses a P2P code', () => {
    const result = parseDownloadTarget('ABCD-1234');
    expect(result.type).toBe('p2p-code');
    expect(result.code).toBe('ABCD-1234');
  });

  it('normalizes P2P code to uppercase', () => {
    const result = parseDownloadTarget('abcd-1234');
    expect(result.type).toBe('p2p-code');
    expect(result.code).toBe('ABCD-1234');
  });

  it('parses a raw file ID', () => {
    const result = parseDownloadTarget('abc123');
    expect(result.type).toBe('file-id');
    expect(result.fileId).toBe('abc123');
  });

  it('parses HTTP URLs', () => {
    const result = parseDownloadTarget('http://localhost:3000/abc123#key');
    expect(result.type).toBe('url-file');
    expect(result.server).toBe('http://localhost:3000');
    expect(result.fileId).toBe('abc123');
    expect(result.keyB64).toBe('key');
  });

  it('parses P2P URL', () => {
    const result = parseDownloadTarget('https://example.com/p2p/ABCD-1234');
    expect(result.type).toBe('p2p-code');
    expect(result.code).toBe('ABCD-1234');
  });

  it('throws on invalid URL', () => {
    expect(() => parseDownloadTarget('https://example.com/')).toThrow();
  });
});

describe('parseLifetime', () => {
  it('parses minutes', () => {
    expect(parseLifetime('30m')).toBe(30 * 60 * 1000);
    expect(parseLifetime('5min')).toBe(5 * 60 * 1000);
    expect(parseLifetime('1minutes')).toBe(60 * 1000);
  });

  it('parses hours', () => {
    expect(parseLifetime('24h')).toBe(24 * 3600 * 1000);
    expect(parseLifetime('1hr')).toBe(3600 * 1000);
    expect(parseLifetime('2hours')).toBe(2 * 3600 * 1000);
  });

  it('parses days', () => {
    expect(parseLifetime('7d')).toBe(7 * 86400 * 1000);
    expect(parseLifetime('1days')).toBe(86400 * 1000);
  });

  it('parses unlimited', () => {
    expect(parseLifetime('0')).toBe(0);
    expect(parseLifetime('unlimited')).toBe(0);
    expect(parseLifetime('Unlimited')).toBe(0);
  });

  it('throws on invalid format', () => {
    expect(() => parseLifetime('abc')).toThrow();
    expect(() => parseLifetime('24x')).toThrow();
    expect(() => parseLifetime('')).toThrow();
  });

  it('parses decimal values', () => {
    expect(parseLifetime('1.5h')).toBe(1.5 * 3600 * 1000);
  });
});

describe('getFlag', () => {
  it('returns string value for matching key', () => {
    expect(getFlag({ server: 'https://example.com' }, 'server')).toBe('https://example.com');
  });

  it('returns undefined for missing key', () => {
    expect(getFlag({}, 'server')).toBeUndefined();
  });

  it('returns undefined for boolean flags', () => {
    expect(getFlag({ json: true }, 'json')).toBeUndefined();
  });

  it('checks multiple keys', () => {
    expect(getFlag({ o: '/tmp' }, 'o', 'output')).toBe('/tmp');
    expect(getFlag({ output: '/tmp' }, 'o', 'output')).toBe('/tmp');
  });
});

describe('getFlagBool', () => {
  it('returns boolean value for matching key', () => {
    expect(getFlagBool({ encrypt: true }, 'encrypt')).toBe(true);
    expect(getFlagBool({ encrypt: false }, 'encrypt')).toBe(false);
  });

  it('returns undefined for missing key', () => {
    expect(getFlagBool({}, 'encrypt')).toBeUndefined();
  });

  it('returns undefined for string flags', () => {
    expect(getFlagBool({ server: 'https://example.com' }, 'server')).toBeUndefined();
  });

  it('checks multiple keys', () => {
    expect(getFlagBool({ y: true }, 'y', 'yes')).toBe(true);
  });
});

describe('getFlagArray', () => {
  it('returns array for array values', () => {
    expect(getFlagArray({ i: ['a.txt', 'b.txt'] }, 'i')).toEqual(['a.txt', 'b.txt']);
  });

  it('wraps string value in array', () => {
    expect(getFlagArray({ i: 'a.txt' }, 'i')).toEqual(['a.txt']);
  });

  it('returns empty array for missing key', () => {
    expect(getFlagArray({}, 'i')).toEqual([]);
  });

  it('returns empty array for boolean flags', () => {
    expect(getFlagArray({ json: true }, 'json')).toEqual([]);
  });

  it('checks multiple keys', () => {
    expect(getFlagArray({ input: 'a.txt' }, 'i', 'input')).toEqual(['a.txt']);
  });
});

describe('hasFlag', () => {
  it('returns true when flag exists', () => {
    expect(hasFlag({ json: true }, 'json')).toBe(true);
    expect(hasFlag({ server: 'url' }, 'server')).toBe(true);
  });

  it('returns false when flag missing', () => {
    expect(hasFlag({}, 'json')).toBe(false);
  });

  it('returns true when any key matches', () => {
    expect(hasFlag({ o: '/tmp' }, 'o', 'output')).toBe(true);
  });

  it('handles false values as present', () => {
    expect(hasFlag({ encrypt: false }, 'encrypt')).toBe(true);
  });
});

describe('sanitizeFilename', () => {
  it('passes through normal filenames', () => {
    expect(sanitizeFilename('document.pdf')).toBe('document.pdf');
    expect(sanitizeFilename('my-file_v2.txt')).toBe('my-file_v2.txt');
  });

  it('replaces path separators', () => {
    expect(sanitizeFilename('path/to/file.txt')).toBe('path_to_file.txt');
    expect(sanitizeFilename('path\\to\\file.txt')).toBe('path_to_file.txt');
  });

  it('replaces leading dots', () => {
    expect(sanitizeFilename('.hidden')).toBe('_hidden');
    expect(sanitizeFilename('..dangerous')).toBe('_dangerous');
  });

  it('replaces illegal characters', () => {
    expect(sanitizeFilename('file<name>.txt')).toBe('file_name_.txt');
    expect(sanitizeFilename('file:name.txt')).toBe('file_name.txt');
    expect(sanitizeFilename('file"name.txt')).toBe('file_name.txt');
    expect(sanitizeFilename('file|name.txt')).toBe('file_name.txt');
    expect(sanitizeFilename('file?name.txt')).toBe('file_name.txt');
    expect(sanitizeFilename('file*name.txt')).toBe('file_name.txt');
  });

  it('returns "download" for empty/whitespace-only names', () => {
    expect(sanitizeFilename('')).toBe('download');
    expect(sanitizeFilename('   ')).toBe('download');
  });

  it('handles path traversal attempts', () => {
    const result = sanitizeFilename('../../../etc/passwd');
    // Slashes are replaced, leading dots are replaced — no directory traversal possible
    expect(result).not.toContain('/');
    expect(result).not.toContain('\\');
    expect(result).not.toMatch(/^\./);
  });
});
