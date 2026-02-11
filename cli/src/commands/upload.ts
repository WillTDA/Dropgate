import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import type { UploadProgressEvent } from '@dropgate/core';
import type { ParsedFlags } from '../lib/parse.js';
import { getFlagArray, getFlag, getFlagBool, hasFlag, parseLifetime } from '../lib/parse.js';
import { createClient } from '../lib/client.js';
import { NodeFileSource } from '../lib/file-source.js';
import { ProgressRenderer } from '../lib/progress.js';
import { readConfig } from '../lib/config-store.js';
import { formatBytes, formatLifetimeHuman, formatCount, formatDuration, pluralize } from '../lib/format.js';
import {
  printHeader,
  printKeyValue,
  printBlank,
  printSuccess,
  printWarning,
  green,
  cyan,
  dim,
  bold,
  boldCyan,
  isQuiet,
  isJson,
} from '../lib/output.js';
import { exitUsage } from '../lib/errors.js';

export async function run(args: string[], flags: ParsedFlags): Promise<void> {
  // Collect input files
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

  // Check for duplicate files
  const seen = new Set<string>();
  for (const src of fileSources) {
    if (seen.has(src.name)) {
      printWarning(`Duplicate file: ${src.name}`);
    }
    seen.add(src.name);
  }

  // Parse options
  const config = readConfig();
  const lifetimeMs = parseLifetime(getFlag(flags, 'lifetime') ?? config.lifetime ?? '24h');
  const maxDownloads = parseInt(getFlag(flags, 'max-downloads') ?? String(config['max-downloads'] ?? 1), 10);

  // Encryption mode
  const encryptFlag = getFlagBool(flags, 'encrypt');
  let encrypt: boolean | undefined;
  if (encryptFlag !== undefined) {
    encrypt = encryptFlag;
  } else if (config.encrypt === 'on') {
    encrypt = true;
  } else if (config.encrypt === 'off') {
    encrypt = false;
  }
  // undefined = auto (let core library decide based on server support)

  // Create client & connect
  const client = createClient(flags);
  const compat = await client.connect();
  const serverInfo = compat.serverInfo;

  const quiet = isQuiet();
  const json = isJson();

  if (!quiet && !json) {
    // Print header
    printHeader('Dropgate Upload');

    printKeyValue('Server', `${compat.baseUrl} ${dim(`v${serverInfo.version}`)}`);

    // File info
    const totalSize = fileSources.reduce((sum, f) => sum + f.size, 0);
    if (fileSources.length === 1) {
      printKeyValue('File', `${fileSources[0].name} ${dim(`(${formatBytes(totalSize)})`)}`);
    } else {
      printKeyValue('Files', `${fileSources.length} ${pluralize(fileSources.length, 'file')} ${dim(`(${formatBytes(totalSize)} total)`)}`);
    }

    printKeyValue('Lifetime', formatLifetimeHuman(lifetimeMs));
    printKeyValue('Downloads', `${formatCount(maxDownloads)}${maxDownloads > 0 ? ' max' : ''}`);

    // Security info
    const e2ee = serverInfo.capabilities?.upload?.e2ee;
    if (encrypt === false) {
      printKeyValue('Security', dim('Encryption disabled'));
    } else if (e2ee) {
      printKeyValue('Security', green('End-to-end encrypted (AES-256-GCM)'));
    } else {
      printKeyValue('Security', dim('Server does not support E2EE'));
    }

    printBlank();
  }

  // Start upload
  const progress = new ProgressRenderer(fileSources.map(f => f.name));
  const abortController = new AbortController();

  // Graceful Ctrl+C
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
    const session = await client.uploadFiles({
      files: fileSources.length === 1 ? fileSources[0] : fileSources,
      lifetimeMs,
      maxDownloads,
      encrypt,
      signal: abortController.signal,
      onProgress: (evt: UploadProgressEvent) => {
        if (!quiet && !json) {
          progress.update(evt);
        }
      },
    });

    const result = await session.result;
    progress.finish();

    if (json) {
      console.log(JSON.stringify({
        downloadUrl: result.downloadUrl,
        fileId: result.fileId,
        bundleId: result.bundleId,
        keyB64: result.keyB64,
        baseUrl: result.baseUrl,
        files: result.files,
        elapsed: progress.getElapsedMs(),
      }, null, 2));
      return;
    }

    if (quiet) {
      console.log(result.downloadUrl);
      return;
    }

    // Success output
    printBlank();
    printSuccess(`Upload complete! ${dim(`(${formatDuration(progress.getElapsedMs())})`)}`);
    printBlank();
    console.log(`  ${dim('Download URL:')} ${boldCyan(result.downloadUrl)}`);
    printBlank();

    // Try clipboard copy
    tryClipboardCopy(result.downloadUrl);
  } finally {
    process.removeListener('SIGINT', sigintHandler);
  }
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

function tryClipboardCopy(text: string): void {
  try {
    if (process.platform === 'win32') {
      execSync(`echo|set /p="${text}"| clip`, { stdio: 'pipe' });
    } else if (process.platform === 'darwin') {
      execSync(`printf '%s' '${text}' | pbcopy`, { stdio: 'pipe' });
    } else {
      execSync(`printf '%s' '${text}' | xclip -selection clipboard 2>/dev/null || printf '%s' '${text}' | xsel --clipboard 2>/dev/null`, { stdio: 'pipe' });
    }
    console.log(`  ${dim('Copied to clipboard.')}`);
  } catch {
    // Clipboard not available - silently skip
  }
}
