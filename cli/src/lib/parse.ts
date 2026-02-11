import { lifetimeToMs, isP2PCodeLike } from '@dropgate/core';

export function parseLifetime(input: string): number {
  if (input === '0' || input.toLowerCase() === 'unlimited') return 0;

  const match = input.match(/^(\d+(?:\.\d+)?)\s*(m|min|minutes?|h|hr|hours?|d|days?)$/i);
  if (!match) {
    throw new Error(`Invalid lifetime format: "${input}". Use formats like "24h", "7d", "30m", or "0" for unlimited.`);
  }

  const value = parseFloat(match[1]);
  const unit = match[2].toLowerCase();

  if (unit.startsWith('m')) return lifetimeToMs(value, 'minutes');
  if (unit.startsWith('h')) return lifetimeToMs(value, 'hours');
  if (unit.startsWith('d')) return lifetimeToMs(value, 'days');

  throw new Error(`Invalid lifetime unit: "${unit}".`);
}

export interface ParsedTarget {
  type: 'url-file' | 'url-bundle' | 'file-id' | 'p2p-code';
  server?: string;
  fileId?: string;
  bundleId?: string;
  keyB64?: string;
  code?: string;
}

export function parseDownloadTarget(target: string): ParsedTarget {
  // Check P2P code first
  if (isP2PCodeLike(target.toUpperCase().trim())) {
    return { type: 'p2p-code', code: target.toUpperCase().trim() };
  }

  // Check URL
  if (target.startsWith('http://') || target.startsWith('https://')) {
    const url = new URL(target);
    const server = url.origin;
    const keyB64 = url.hash ? url.hash.slice(1) : undefined;
    const pathParts = url.pathname.split('/').filter(Boolean);

    if (pathParts[0] === 'b' && pathParts[1]) {
      return { type: 'url-bundle', server, bundleId: pathParts[1], keyB64 };
    }
    if (pathParts[0] === 'p2p' && pathParts[1]) {
      return { type: 'p2p-code', server, code: pathParts[1].toUpperCase() };
    }
    if (pathParts[0]) {
      return { type: 'url-file', server, fileId: pathParts[0], keyB64 };
    }

    throw new Error(`Could not parse download URL: ${target}`);
  }

  // Raw file ID
  return { type: 'file-id', fileId: target };
}

export interface ParsedFlags {
  [key: string]: string | string[] | boolean | undefined;
}

export interface ParsedArgs {
  command: string;
  args: string[];
  flags: ParsedFlags;
}

export function parseArgs(argv: string[]): ParsedArgs {
  // Skip node executable and script path
  const raw = argv.slice(2);

  // Find the command: first positional arg that isn't a flag or flag value
  let command = '';
  let commandIndex = -1;
  for (let i = 0; i < raw.length; i++) {
    const arg = raw[i];
    if (arg === '--') break;
    if (arg.startsWith('-')) {
      // Skip boolean flags like --no-color, --help, --version
      if (arg.startsWith('--no-') || arg === '--help' || arg === '--version' ||
          arg === '--quiet' || arg === '--json') {
        continue;
      }
      // Skip value flags and their value
      if (arg.startsWith('--') || (arg.startsWith('-') && arg.length === 2)) {
        i++; // skip the value
        continue;
      }
      continue;
    }
    // First non-flag argument is the command
    command = arg;
    commandIndex = i;
    break;
  }

  const rest = commandIndex >= 0
    ? [...raw.slice(0, commandIndex), ...raw.slice(commandIndex + 1)]
    : raw;

  const args: string[] = [];
  const flags: ParsedFlags = {};

  for (let i = 0; i < rest.length; i++) {
    const arg = rest[i];

    if (arg === '--') {
      args.push(...rest.slice(i + 1));
      break;
    }

    if (arg.startsWith('--no-')) {
      const key = arg.slice(5);
      flags[key] = false;
      continue;
    }

    if (arg.startsWith('--')) {
      const key = arg.slice(2);
      const next = rest[i + 1];

      // Boolean flags (no value follows)
      if (!next || next.startsWith('-')) {
        flags[key] = true;
        continue;
      }

      // Value flag
      i++;
      if (flags[key] !== undefined) {
        // Already set - convert to array for repeatable flags
        const existing = flags[key];
        if (Array.isArray(existing)) {
          existing.push(next);
        } else {
          flags[key] = [String(existing), next];
        }
      } else {
        flags[key] = next;
      }
      continue;
    }

    if (arg.startsWith('-') && arg.length === 2) {
      const key = arg.slice(1);
      const next = rest[i + 1];

      if (!next || next.startsWith('-')) {
        flags[key] = true;
        continue;
      }

      i++;
      if (flags[key] !== undefined) {
        const existing = flags[key];
        if (Array.isArray(existing)) {
          existing.push(next);
        } else {
          flags[key] = [String(existing), next];
        }
      } else {
        flags[key] = next;
      }
      continue;
    }

    args.push(arg);
  }

  return { command, args, flags };
}

export function getFlag(flags: ParsedFlags, ...keys: string[]): string | undefined {
  for (const key of keys) {
    const val = flags[key];
    if (typeof val === 'string') return val;
  }
  return undefined;
}

export function getFlagBool(flags: ParsedFlags, ...keys: string[]): boolean | undefined {
  for (const key of keys) {
    const val = flags[key];
    if (typeof val === 'boolean') return val;
  }
  return undefined;
}

export function getFlagArray(flags: ParsedFlags, ...keys: string[]): string[] {
  for (const key of keys) {
    const val = flags[key];
    if (Array.isArray(val)) return val;
    if (typeof val === 'string') return [val];
  }
  return [];
}

export function hasFlag(flags: ParsedFlags, ...keys: string[]): boolean {
  return keys.some(k => flags[k] !== undefined);
}

export function sanitizeFilename(name: string): string {
  return name
    .replace(/[/\\]/g, '_')
    .replace(/^\.+/, '_')
    .replace(/[<>:"|?*\x00-\x1f]/g, '_')
    .trim() || 'download';
}
