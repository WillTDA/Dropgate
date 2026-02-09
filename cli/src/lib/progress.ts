import { formatBytes, formatSpeed, formatEta } from './format.js';
import { dim, cyan, green, bold, hideCursor, showCursor, clearLine, cursorUp } from './output.js';

const BAR_CHAR_FILLED = '\u2501';
const BAR_CHAR_HEAD = '\u257A';
const BAR_CHAR_EMPTY = '\u2500';

interface SpeedSample {
  time: number;
  bytes: number;
}

export class ProgressRenderer {
  private startTime = 0;
  private samples: SpeedSample[] = [];
  private smoothedSpeed = 0;
  private lastRenderTime = 0;
  private lastPercent = -1;
  private renderedLines = 0;
  private finished = false;

  // Multi-file state
  private fileNames: string[] = [];
  private fileCount = 0;
  private currentFileIndex = -1;

  constructor(fileNames?: string[]) {
    if (fileNames) {
      this.fileNames = fileNames;
      this.fileCount = fileNames.length;
    }
  }

  update(evt: {
    percent: number;
    processedBytes: number;
    totalBytes: number;
    phase?: string;
    text?: string;
    fileIndex?: number;
    totalFiles?: number;
    currentFileName?: string;
  }): void {
    if (this.finished || !process.stdout.isTTY) return;

    const now = Date.now();
    if (this.startTime === 0) {
      this.startTime = now;
      hideCursor();
    }

    // Track multi-file info
    if (evt.totalFiles && evt.totalFiles > 1) {
      this.fileCount = evt.totalFiles;
      if (evt.fileIndex !== undefined) {
        this.currentFileIndex = evt.fileIndex;
      }
    }

    // Speed sampling (rolling window of ~3 seconds)
    this.samples.push({ time: now, bytes: evt.processedBytes });
    const windowStart = now - 3000;
    while (this.samples.length > 2 && this.samples[0].time < windowStart) {
      this.samples.shift();
    }

    // Calculate speed from rolling window
    if (this.samples.length >= 2) {
      const oldest = this.samples[0];
      const newest = this.samples[this.samples.length - 1];
      const dt = (newest.time - oldest.time) / 1000;
      if (dt > 0) {
        const rawSpeed = (newest.bytes - oldest.bytes) / dt;
        // Exponential smoothing
        this.smoothedSpeed = this.smoothedSpeed === 0
          ? rawSpeed
          : this.smoothedSpeed * 0.7 + rawSpeed * 0.3;
      }
    }

    // Throttle renders to ~15fps
    if (now - this.lastRenderTime < 67 && evt.percent < 100) return;
    this.lastRenderTime = now;

    // Skip non-transfer phases for progress bar display
    const phase = evt.phase || '';
    if (['server-info', 'server-compat', 'crypto', 'init', 'metadata'].includes(phase)) {
      if (evt.text) {
        this.renderStatus(evt.text);
      }
      return;
    }

    this.renderProgressBar(evt.percent, evt.processedBytes, evt.totalBytes, evt.currentFileName);
  }

  private renderStatus(text: string): void {
    clearLine();
    process.stdout.write(`  ${dim(text)}\r`);
    this.renderedLines = 1;
  }

  private renderProgressBar(percent: number, processed: number, total: number, fileName?: string): void {
    // Clear previous render
    if (this.renderedLines > 0) {
      cursorUp(this.renderedLines - 1);
    }

    const termWidth = process.stdout.columns || 80;
    const lines: string[] = [];

    // File label
    const label = fileName
      ? (this.fileCount > 1
        ? `  ${dim(`[${this.currentFileIndex + 1}/${this.fileCount}]`)} ${fileName}`
        : `  ${fileName}`)
      : '';

    if (label) {
      lines.push(label);
    }

    // Progress bar line
    const pct = Math.min(100, Math.max(0, percent));
    const pctStr = `${Math.floor(pct)}%`.padStart(4);
    const speedStr = this.smoothedSpeed > 0 ? formatSpeed(this.smoothedSpeed) : '---';

    let etaStr: string;
    if (pct >= 100) {
      etaStr = green('Done');
    } else if (this.smoothedSpeed > 0 && total > 0) {
      const remaining = (total - processed) / this.smoothedSpeed;
      etaStr = `ETA ${formatEta(remaining)}`;
    } else {
      etaStr = '';
    }

    // Calculate bar width: "  [bar] pct  speed  ETA eta"
    const suffix = `${pctStr}  ${speedStr}  ${etaStr}`;
    const barMaxWidth = termWidth - 4 - suffix.length - 2; // 4 for "  [" + "]", 2 for padding
    const barWidth = Math.max(10, Math.min(barMaxWidth, 50));

    const filledWidth = Math.round((pct / 100) * barWidth);
    const emptyWidth = barWidth - filledWidth;

    let bar: string;
    if (pct >= 100) {
      bar = green(BAR_CHAR_FILLED.repeat(barWidth));
    } else if (filledWidth === 0) {
      bar = dim(BAR_CHAR_EMPTY.repeat(barWidth));
    } else {
      bar = cyan(BAR_CHAR_FILLED.repeat(filledWidth - 1) + BAR_CHAR_HEAD) + dim(BAR_CHAR_EMPTY.repeat(emptyWidth));
    }

    lines.push(`  [${bar}] ${suffix}`);

    // Write lines
    for (let i = 0; i < lines.length; i++) {
      clearLine();
      process.stdout.write(lines[i] + (i < lines.length - 1 ? '\n' : '\r'));
    }

    // Clear orphaned lines from previous render (e.g., filename label disappears on final event)
    const orphaned = this.renderedLines - lines.length;
    if (orphaned > 0) {
      for (let i = 0; i < orphaned; i++) {
        process.stdout.write('\n');
        clearLine();
      }
      cursorUp(orphaned);
    }

    this.renderedLines = lines.length;
  }

  finish(): void {
    if (this.finished) return;
    this.finished = true;
    showCursor();

    if (!process.stdout.isTTY) return;

    // Move below the progress display
    if (this.renderedLines > 0) {
      // Move to end of last rendered line then newline
      process.stdout.write('\n');
    }
  }

  getElapsedMs(): number {
    return this.startTime > 0 ? Date.now() - this.startTime : 0;
  }

  getAverageSpeed(): number {
    const elapsed = this.getElapsedMs() / 1000;
    if (elapsed <= 0) return 0;
    const last = this.samples[this.samples.length - 1];
    return last ? last.bytes / elapsed : 0;
  }

  reset(): void {
    this.startTime = 0;
    this.samples = [];
    this.smoothedSpeed = 0;
    this.lastRenderTime = 0;
    this.lastPercent = -1;
    this.renderedLines = 0;
    this.finished = false;
    this.currentFileIndex = -1;
  }
}
