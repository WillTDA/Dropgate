import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

export interface DropgateCliConfig {
  server?: string;
  lifetime?: string;
  'max-downloads'?: number;
  encrypt?: 'auto' | 'on' | 'off';
}

const DEFAULT_CONFIG: DropgateCliConfig = {
  server: undefined,
  lifetime: '24h',
  'max-downloads': 1,
  encrypt: 'auto',
};

const VALID_KEYS = new Set(['server', 'lifetime', 'max-downloads', 'encrypt']);

function getConfigDir(): string {
  if (process.platform === 'win32') {
    return path.join(process.env.APPDATA || path.join(os.homedir(), 'AppData', 'Roaming'), 'dropgate');
  }
  if (process.platform === 'darwin') {
    return path.join(os.homedir(), 'Library', 'Application Support', 'dropgate');
  }
  return path.join(process.env.XDG_CONFIG_HOME || path.join(os.homedir(), '.config'), 'dropgate');
}

export function getConfigPath(): string {
  return path.join(getConfigDir(), 'config.json');
}

export function readConfig(): DropgateCliConfig {
  const configPath = getConfigPath();
  try {
    const raw = fs.readFileSync(configPath, 'utf-8');
    return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULT_CONFIG };
  }
}

export function writeConfig(config: DropgateCliConfig): void {
  const configPath = getConfigPath();
  const dir = path.dirname(configPath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2) + '\n', 'utf-8');
}

export function getConfigValue(key: string): string | number | undefined {
  const config = readConfig();
  return config[key as keyof DropgateCliConfig];
}

export function setConfigValue(key: string, value: string): void {
  validateConfigKey(key);
  const config = readConfig();

  if (key === 'max-downloads') {
    const n = parseInt(value, 10);
    if (isNaN(n) || n < 0) throw new Error(`Invalid value for max-downloads: "${value}". Must be a non-negative integer.`);
    config['max-downloads'] = n;
  } else if (key === 'encrypt') {
    if (!['auto', 'on', 'off'].includes(value)) {
      throw new Error(`Invalid value for encrypt: "${value}". Must be "auto", "on", or "off".`);
    }
    config.encrypt = value as 'auto' | 'on' | 'off';
  } else {
    (config as Record<string, unknown>)[key] = value;
  }

  writeConfig(config);
}

export function resetConfig(): void {
  writeConfig({ ...DEFAULT_CONFIG });
}

export function validateConfigKey(key: string): void {
  if (!VALID_KEYS.has(key)) {
    throw new Error(`Unknown config key: "${key}". Valid keys: ${[...VALID_KEYS].join(', ')}`);
  }
}

export function getDefaults(): DropgateCliConfig {
  return { ...DEFAULT_CONFIG };
}
