import fs from 'node:fs';
import path from 'node:path';
import { DropgateClient } from '@dropgate/core';
import type { DownloadProgressEvent } from '@dropgate/core';
import type { ParsedFlags } from '../lib/parse.js';
import { getFlag, hasFlag, parseDownloadTarget, sanitizeFilename } from '../lib/parse.js';
import { createClient } from '../lib/client.js';
import { ProgressRenderer } from '../lib/progress.js';
import { formatBytes, formatDuration } from '../lib/format.js';
import {
  printHeader,
  printKeyValue,
  printBlank,
  printSuccess,
  green,
  dim,
  boldCyan,
  isQuiet,
  isJson,
} from '../lib/output.js';
import { exitUsage, exitError } from '../lib/errors.js';
import { run as receiveRun } from './receive.js';

export async function run(args: string[], flags: ParsedFlags): Promise<void> {
  const target = args[0];
  if (!target) {
    exitUsage('A download target is required (URL, file ID, or P2P share code).');
  }

  const parsed = parseDownloadTarget(target);

  // Delegate P2P codes to receive
  if (parsed.type === 'p2p-code') {
    return receiveRun([parsed.code!], flags);
  }

  const quiet = isQuiet();
  const json = isJson();

  // Determine server + IDs
  let server: string;
  let fileId: string | undefined;
  let bundleId: string | undefined;
  let keyB64: string | undefined;

  if (parsed.type === 'url-file') {
    server = parsed.server!;
    fileId = parsed.fileId;
    keyB64 = parsed.keyB64;
  } else if (parsed.type === 'url-bundle') {
    server = parsed.server!;
    bundleId = parsed.bundleId;
    keyB64 = parsed.keyB64;
  } else {
    // Raw file ID
    fileId = parsed.fileId;
    keyB64 = getFlag(flags, 'key');
    const configOrFlag = getFlag(flags, 'server');
    if (!configOrFlag) {
      const { readConfig } = await import('../lib/config-store.js');
      const config = readConfig();
      server = config.server ?? '';
      if (!server) exitError('No server configured. Use --server <url> or run: dropgate config set server <url>');
    } else {
      server = configOrFlag;
    }
  }

  // Create client
  const client = new DropgateClient({
    clientVersion: process.env.DROPGATE_CLI_VERSION || '3.0.3',
    server: server!,
    fallbackToHttp: true,
  });

  const compat = await client.connect();
  const outputDir = path.resolve(getFlag(flags, 'o', 'output') ?? '.');
  fs.mkdirSync(outputDir, { recursive: true });

  const progress = new ProgressRenderer();
  const abortController = new AbortController();

  let cancelCount = 0;
  const sigintHandler = () => {
    cancelCount++;
    if (cancelCount === 1) {
      abortController.abort();
    } else {
      process.exit(130);
    }
  };
  process.on('SIGINT', sigintHandler);

  try {
    if (bundleId) {
      await downloadBundle(client, compat, bundleId, keyB64, outputDir, progress, abortController, quiet, json);
    } else if (fileId) {
      await downloadSingleFile(client, compat, fileId, keyB64, outputDir, progress, abortController, quiet, json);
    }
  } finally {
    process.removeListener('SIGINT', sigintHandler);
  }
}

async function downloadSingleFile(
  client: DropgateClient,
  compat: { baseUrl: string; serverInfo: { version: string; name?: string } },
  fileId: string,
  keyB64: string | undefined,
  outputDir: string,
  progress: ProgressRenderer,
  abortController: AbortController,
  quiet: boolean,
  json: boolean,
): Promise<void> {
  // Fetch metadata for display
  const meta = await client.getFileMetadata(fileId);

  if (!quiet && !json) {
    printHeader('Dropgate Download');
    printKeyValue('Server', `${compat.baseUrl} ${dim(`v${compat.serverInfo.version}`)}`);
    const displayName = meta.filename ?? fileId;
    printKeyValue('File', `${displayName} ${dim(`(${formatBytes(meta.sizeBytes)})`)}`);
    printKeyValue('Security', meta.isEncrypted ? green('Encrypted (decrypting...)') : dim('Unencrypted'));
    printBlank();
  }

  // Download with streaming
  const tmpPath = path.join(outputDir, `dropgate-dl-${fileId}.tmp`);
  const writeStream = fs.createWriteStream(tmpPath);

  const result = await client.downloadFiles({
    fileId,
    keyB64,
    signal: abortController.signal,
    onProgress: (evt: DownloadProgressEvent) => {
      if (!quiet && !json) {
        progress.update(evt);
      }
    },
    onData: async (chunk: Uint8Array) => {
      await new Promise<void>((resolve, reject) => {
        const ok = writeStream.write(Buffer.from(chunk));
        if (ok) resolve();
        else writeStream.once('drain', resolve);
      });
    },
  });

  progress.finish();

  await new Promise<void>((resolve, reject) => {
    writeStream.end(() => resolve());
    writeStream.on('error', reject);
  });

  // Rename to final filename
  const fileName = sanitizeFilename(result.filename ?? `file-${fileId}`);
  const finalPath = path.join(outputDir, fileName);
  fs.renameSync(tmpPath, finalPath);

  if (json) {
    console.log(JSON.stringify({
      savedTo: finalPath,
      filename: fileName,
      receivedBytes: result.receivedBytes,
      wasEncrypted: result.wasEncrypted,
      elapsed: progress.getElapsedMs(),
    }, null, 2));
    return;
  }

  if (quiet) {
    console.log(finalPath);
    return;
  }

  printBlank();
  printSuccess(`Download complete! ${dim(`(${formatDuration(progress.getElapsedMs())})`)}`);
  console.log(`  ${dim('Saved to:')} ${boldCyan(finalPath)} ${dim(`(${formatBytes(result.receivedBytes)})`)}`);
  printBlank();
}

async function downloadBundle(
  client: DropgateClient,
  compat: { baseUrl: string; serverInfo: { version: string; name?: string } },
  bundleId: string,
  keyB64: string | undefined,
  outputDir: string,
  progress: ProgressRenderer,
  abortController: AbortController,
  quiet: boolean,
  json: boolean,
): Promise<void> {
  // Fetch bundle metadata
  const bundleMeta = await client.getBundleMetadata(bundleId, keyB64);

  if (!quiet && !json) {
    printHeader('Dropgate Download');
    printKeyValue('Server', `${compat.baseUrl} ${dim(`v${compat.serverInfo.version}`)}`);
    printKeyValue('Bundle', `${bundleMeta.fileCount} files ${dim(`(${formatBytes(bundleMeta.totalSizeBytes)} total)`)}`);
    printKeyValue('Security', bundleMeta.isEncrypted ? green('Encrypted (decrypting...)') : dim('Unencrypted'));
    printBlank();
  }

  // Download individual files
  let currentWriteStream: fs.WriteStream | null = null;
  const savedFiles: string[] = [];

  const result = await client.downloadFiles({
    bundleId,
    keyB64,
    signal: abortController.signal,
    onProgress: (evt: DownloadProgressEvent) => {
      if (!quiet && !json) {
        progress.update(evt);
      }
    },
    onFileStart: (file: { name: string; size: number; index: number }) => {
      const safeName = sanitizeFilename(file.name);
      const filePath = path.join(outputDir, safeName);
      savedFiles.push(filePath);
      currentWriteStream = fs.createWriteStream(filePath);
    },
    onFileData: async (chunk: Uint8Array) => {
      if (currentWriteStream) {
        await new Promise<void>((resolve) => {
          const ok = currentWriteStream!.write(Buffer.from(chunk));
          if (ok) resolve();
          else currentWriteStream!.once('drain', resolve);
        });
      }
    },
    onFileEnd: (_file: { name: string; index: number }) => {
      if (currentWriteStream) {
        currentWriteStream.end();
        currentWriteStream = null;
      }
    },
  });

  progress.finish();

  if (json) {
    console.log(JSON.stringify({
      savedTo: outputDir,
      files: savedFiles.map(f => path.basename(f)),
      filePaths: savedFiles,
      receivedBytes: result.receivedBytes,
      wasEncrypted: result.wasEncrypted,
      elapsed: progress.getElapsedMs(),
    }, null, 2));
    return;
  }

  if (quiet) {
    savedFiles.forEach(f => console.log(f));
    return;
  }

  printBlank();
  printSuccess(`Download complete! ${dim(`(${formatDuration(progress.getElapsedMs())})`)}`);
  console.log(`  ${dim('Saved to:')} ${boldCyan(outputDir)} ${dim(`(${formatBytes(result.receivedBytes)})`)}`);
  for (const f of savedFiles) {
    console.log(`    ${dim('\u2514')} ${path.basename(f)}`);
  }
  printBlank();
}
