import type { ParsedFlags } from '../lib/parse.js';
import { hasFlag } from '../lib/parse.js';
import { createClient } from '../lib/client.js';
import { formatBytes } from '../lib/format.js';
import {
  printHeader,
  printKeyValue,
  printBlank,
  green,
  red,
  yellow,
  dim,
  bold,
} from '../lib/output.js';

export async function run(_args: string[], flags: ParsedFlags): Promise<void> {
  const client = createClient(flags);
  const compat = await client.connect();
  const { serverInfo, baseUrl } = compat;

  if (hasFlag(flags, 'json')) {
    console.log(JSON.stringify({ baseUrl, ...compat, serverInfo }, null, 2));
    return;
  }

  printHeader('Dropgate Server Info');

  printKeyValue('Server', baseUrl);
  if (serverInfo.name) printKeyValue('Name', serverInfo.name);
  printKeyValue('Version', serverInfo.version);
  printKeyValue('Compatible', compat.compatible ? green('Yes') : red(`No - ${compat.message}`));
  printBlank();

  const caps = serverInfo.capabilities;
  if (!caps) {
    console.log(`  ${dim('No capabilities reported by server.')}`);
    printBlank();
    return;
  }

  console.log(`  ${bold('Capabilities')}`);
  printBlank();

  // Upload
  if (caps.upload) {
    printKeyValue('Uploads', caps.upload.enabled ? green('Enabled') : red('Disabled'));
    if (caps.upload.enabled) {
      printKeyValue('  Max size', caps.upload.maxSizeMB ? `${caps.upload.maxSizeMB} MB` : dim('Unlimited'), 0);
      printKeyValue(
        '  Max lifetime',
        caps.upload.maxLifetimeHours
          ? `${caps.upload.maxLifetimeHours} hours${caps.upload.maxLifetimeHours >= 24 ? ` (${caps.upload.maxLifetimeHours / 24} days)` : ''}`
          : dim('Unlimited'),
        0,
      );
      printKeyValue(
        '  Max downloads',
        caps.upload.maxFileDownloads ? String(caps.upload.maxFileDownloads) : dim('Unlimited'),
        0,
      );
      printKeyValue('  E2EE', caps.upload.e2ee ? green('Supported') : yellow('Not available'), 0);
      if (caps.upload.chunkSize) {
        printKeyValue('  Chunk size', formatBytes(caps.upload.chunkSize), 0);
      }
    }
  }

  // P2P
  if (caps.p2p) {
    printKeyValue('P2P', caps.p2p.enabled ? green('Enabled') : red('Disabled'));
  }

  // Web UI
  if (caps.webUI) {
    printKeyValue('Web UI', caps.webUI.enabled ? green('Enabled') : red('Disabled'));
  }

  printBlank();
}
