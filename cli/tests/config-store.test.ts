import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  readConfig,
  writeConfig,
  setConfigValue,
  getConfigValue,
  resetConfig,
  validateConfigKey,
  getConfigPath,
  getDefaults,
} from '../src/lib/config-store.js';

// Use a temporary directory for config during tests
let tmpDir: string;
let originalEnv: NodeJS.ProcessEnv;

beforeEach(() => {
  tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'dropgate-test-'));
  originalEnv = { ...process.env };

  if (process.platform === 'win32') {
    process.env.APPDATA = tmpDir;
  } else if (process.platform === 'darwin') {
    // Override HOME for macOS config path
    vi.stubEnv('HOME', tmpDir);
  } else {
    process.env.XDG_CONFIG_HOME = tmpDir;
  }
});

afterEach(() => {
  process.env = originalEnv;
  vi.unstubAllEnvs();
  fs.rmSync(tmpDir, { recursive: true, force: true });
});

describe('validateConfigKey', () => {
  it('accepts valid keys', () => {
    expect(() => validateConfigKey('server')).not.toThrow();
    expect(() => validateConfigKey('lifetime')).not.toThrow();
    expect(() => validateConfigKey('max-downloads')).not.toThrow();
    expect(() => validateConfigKey('encrypt')).not.toThrow();
  });

  it('rejects invalid keys', () => {
    expect(() => validateConfigKey('unknown')).toThrow('Unknown config key');
    expect(() => validateConfigKey('')).toThrow('Unknown config key');
    expect(() => validateConfigKey('Server')).toThrow('Unknown config key');
  });
});

describe('setConfigValue', () => {
  it('rejects invalid max-downloads', () => {
    expect(() => setConfigValue('max-downloads', 'abc')).toThrow('Invalid value for max-downloads');
    expect(() => setConfigValue('max-downloads', '-1')).toThrow('Invalid value for max-downloads');
  });

  it('accepts valid max-downloads', () => {
    expect(() => setConfigValue('max-downloads', '0')).not.toThrow();
    expect(() => setConfigValue('max-downloads', '5')).not.toThrow();
  });

  it('rejects invalid encrypt values', () => {
    expect(() => setConfigValue('encrypt', 'yes')).toThrow('Invalid value for encrypt');
    expect(() => setConfigValue('encrypt', 'true')).toThrow('Invalid value for encrypt');
  });

  it('accepts valid encrypt values', () => {
    expect(() => setConfigValue('encrypt', 'auto')).not.toThrow();
    expect(() => setConfigValue('encrypt', 'on')).not.toThrow();
    expect(() => setConfigValue('encrypt', 'off')).not.toThrow();
  });

  it('rejects unknown keys', () => {
    expect(() => setConfigValue('unknown', 'value')).toThrow('Unknown config key');
  });

  it('persists server value', () => {
    setConfigValue('server', 'https://example.com');
    expect(getConfigValue('server')).toBe('https://example.com');
  });

  it('persists lifetime value', () => {
    setConfigValue('lifetime', '48h');
    expect(getConfigValue('lifetime')).toBe('48h');
  });
});

describe('readConfig / writeConfig', () => {
  it('returns defaults when no config file exists', () => {
    const config = readConfig();
    expect(config.server).toBeUndefined();
    expect(config.lifetime).toBe('24h');
    expect(config['max-downloads']).toBe(1);
    expect(config.encrypt).toBe('auto');
  });

  it('reads back written config', () => {
    writeConfig({ server: 'https://test.com', lifetime: '7d', 'max-downloads': 5, encrypt: 'on' });
    const config = readConfig();
    expect(config.server).toBe('https://test.com');
    expect(config.lifetime).toBe('7d');
    expect(config['max-downloads']).toBe(5);
    expect(config.encrypt).toBe('on');
  });

  it('merges with defaults', () => {
    writeConfig({ server: 'https://test.com' } as any);
    const config = readConfig();
    expect(config.server).toBe('https://test.com');
    expect(config.lifetime).toBe('24h'); // default
  });
});

describe('resetConfig', () => {
  it('resets to defaults', () => {
    setConfigValue('server', 'https://test.com');
    resetConfig();
    const config = readConfig();
    expect(config.server).toBeUndefined();
    expect(config.lifetime).toBe('24h');
  });
});

describe('getDefaults', () => {
  it('returns default config', () => {
    const defaults = getDefaults();
    expect(defaults.server).toBeUndefined();
    expect(defaults.lifetime).toBe('24h');
    expect(defaults['max-downloads']).toBe(1);
    expect(defaults.encrypt).toBe('auto');
  });

  it('returns a copy (not mutable reference)', () => {
    const d1 = getDefaults();
    d1.server = 'modified';
    const d2 = getDefaults();
    expect(d2.server).toBeUndefined();
  });
});

describe('getConfigPath', () => {
  it('returns a path string', () => {
    const p = getConfigPath();
    expect(typeof p).toBe('string');
    expect(p).toContain('dropgate');
    expect(p).toContain('config.json');
  });
});
