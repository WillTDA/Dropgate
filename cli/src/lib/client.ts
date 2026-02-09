import { DropgateClient } from '@dropgate/core';
import { readConfig } from './config-store.js';
import { getFlag, type ParsedFlags } from './parse.js';
import { exitError } from './errors.js';

const CLI_VERSION = process.env.DROPGATE_CLI_VERSION || '3.0.2';

export function createClient(flags: ParsedFlags): DropgateClient {
  const config = readConfig();
  const server = getFlag(flags, 'server') || config.server;

  if (!server) {
    exitError(
      'No server configured.\n  Run: dropgate config set server <url>',
    );
  }

  return new DropgateClient({
    clientVersion: CLI_VERSION,
    server,
    fallbackToHttp: true,
  });
}

export function requireServer(flags: ParsedFlags): string {
  const config = readConfig();
  const server = getFlag(flags, 'server') || config.server;
  if (!server) {
    exitError(
      'No server configured.\n  Run: dropgate config set server <url>',
    );
  }
  return server;
}
