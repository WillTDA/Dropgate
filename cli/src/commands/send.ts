import fs from 'node:fs';
import path from 'node:path';
import type { ParsedFlags } from '../lib/parse.js';
import { getFlagArray } from '../lib/parse.js';
import { createClient } from '../lib/client.js';
import { NodeFileSource } from '../lib/file-source.js';
import { ProgressRenderer } from '../lib/progress.js';
import { formatBytes, formatDuration, pluralize } from '../lib/format.js';
import {
  printHeader,
  printKeyValue,
  printBlank,
  printSuccess,
  printWarning,
  dim,
  bold,
  boldCyan,
  isQuiet,
} from '../lib/output.js';
import { exitUsage, exitError } from '../lib/errors.js';

export async function run(args: string[], flags: ParsedFlags): Promise<void> {
  const filePaths = getFlagArray(flags, 'i', 'input');
  if (filePaths.length === 0) {
    exitUsage('At least one file is required. Use -i <file>.');
  }

  // Resolve paths: expand directories recursively, validate files exist
  const resolvedPaths: string[] = [];
  for (const fp of filePaths) {
    if (!fs.existsSync(fp)) {
      exitUsage(`File not found: ${fp}`);
    }
    const stat = fs.statSync(fp);
    if (stat.isDirectory()) {
      resolvedPaths.push(...walkDir(fp));
    } else {
      resolvedPaths.push(fp);
    }
  }

  if (resolvedPaths.length === 0) {
    exitUsage('No files found. The specified directories are empty.');
  }

  const fileSources: NodeFileSource[] = resolvedPaths.map(fp => new NodeFileSource(fp));

  // Load PeerJS (bundled into the CLI build)
  let Peer: any;
  try {
    const peerModule = await import('peerjs');
    Peer = peerModule.Peer ?? peerModule.default?.Peer ?? peerModule.default;
  } catch {
    exitError(
      'PeerJS failed to load. P2P transfers require WebRTC support in the runtime environment.',
    );
  }

  const client = createClient(flags);
  const compat = await client.connect();
  const quiet = isQuiet();

  if (!quiet) {
    printHeader('Dropgate Send');

    printKeyValue('Server', `${compat.baseUrl} ${dim(`v${compat.serverInfo.version}`)}`);
    const totalSize = fileSources.reduce((sum, f) => sum + f.size, 0);
    if (fileSources.length === 1) {
      printKeyValue('File', `${fileSources[0].name} ${dim(`(${formatBytes(totalSize)})`)}`);
    } else {
      printKeyValue('Files', `${fileSources.length} ${pluralize(fileSources.length, 'file')} ${dim(`(${formatBytes(totalSize)} total)`)}`);
    }
    printBlank();
  }

  const progress = new ProgressRenderer(fileSources.map(f => f.name));

  return new Promise<void>((resolve, reject) => {
    let session: any;

    // Graceful Ctrl+C
    let cancelCount = 0;
    const sigintHandler = () => {
      cancelCount++;
      if (cancelCount === 1) {
        if (session) session.stop();
        progress.finish();
        printWarning('Transfer cancelled.');
        resolve();
      } else {
        process.exit(130);
      }
    };
    process.on('SIGINT', sigintHandler);

    const cleanup = () => {
      process.removeListener('SIGINT', sigintHandler);
    };

    client.p2pSend({
      file: fileSources.length === 1 ? fileSources[0] : fileSources,
      Peer,
      onCode: (code: string) => {
        if (quiet) {
          console.log(code);
        } else {
          printBlank();
          console.log(`  ${dim('Share Code:')} ${boldCyan(code)}`);
          printBlank();
          console.log(`  ${dim('Waiting for receiver...')}`);
        }
      },
      onStatus: (evt: { phase: string; message: string }) => {
        if (!quiet && evt.phase === 'connected') {
          printBlank();
          printSuccess('Receiver connected. Sending...');
          printBlank();
        }
      },
      onProgress: (evt: { percent: number; processedBytes: number; totalBytes: number }) => {
        if (!quiet) {
          progress.update(evt);
        }
      },
      onComplete: () => {
        progress.finish();
        cleanup();
        if (!quiet) {
          printBlank();
          printSuccess(`Transfer complete! ${dim(`(${formatDuration(progress.getElapsedMs())})`)}`);
          printBlank();
        }
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
        if (!quiet) {
          printWarning(`Transfer cancelled by ${evt.cancelledBy}.`);
        }
        resolve();
      },
      onDisconnect: () => {
        progress.finish();
        cleanup();
        if (!quiet) {
          printWarning('Receiver disconnected.');
        }
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

function walkDir(dir: string): string[] {
  const results: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...walkDir(fullPath));
    } else if (entry.isFile()) {
      results.push(fullPath);
    }
  }
  return results;
}
