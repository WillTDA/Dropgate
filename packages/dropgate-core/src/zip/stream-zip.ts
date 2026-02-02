import { Zip, ZipPassThrough } from 'fflate';

/**
 * Streaming ZIP writer that assembles files into a ZIP archive on the fly.
 * Uses fflate's store mode (no compression) for maximum speed and minimal memory usage.
 * Works in both Node.js and browser environments.
 */
export class StreamingZipWriter {
  private zip: InstanceType<typeof Zip>;
  private currentFile: InstanceType<typeof ZipPassThrough> | null = null;
  private onData: (chunk: Uint8Array) => void | Promise<void>;
  private finalized = false;
  private pendingWrites: Promise<void> = Promise.resolve();

  constructor(onData: (chunk: Uint8Array) => void | Promise<void>) {
    this.onData = onData;
    this.zip = new Zip((err, data, _final) => {
      if (err) throw err;
      // Queue data delivery to handle async consumers
      this.pendingWrites = this.pendingWrites.then(() => this.onData(data));
    });
  }

  /**
   * Begin a new file entry in the ZIP.
   * Must call endFile() before starting another file.
   * @param name - Filename within the ZIP archive.
   */
  startFile(name: string): void {
    if (this.currentFile) {
      throw new Error('Must call endFile() before starting a new file.');
    }
    if (this.finalized) {
      throw new Error('ZIP has already been finalized.');
    }
    const entry = new ZipPassThrough(name);
    this.zip.add(entry);
    this.currentFile = entry;
  }

  /**
   * Write a chunk of data to the current file entry.
   * @param data - The data chunk to write.
   */
  writeChunk(data: Uint8Array): void {
    if (!this.currentFile) {
      throw new Error('No file started. Call startFile() first.');
    }
    this.currentFile.push(data, false);
  }

  /**
   * End the current file entry.
   */
  endFile(): void {
    if (!this.currentFile) {
      throw new Error('No file to end.');
    }
    this.currentFile.push(new Uint8Array(0), true);
    this.currentFile = null;
  }

  /**
   * Finalize the ZIP archive. Must be called after all files are written.
   * Waits for all pending async writes to complete before resolving.
   */
  async finalize(): Promise<void> {
    if (this.currentFile) {
      throw new Error('Cannot finalize with an open file. Call endFile() first.');
    }
    if (this.finalized) return;
    this.finalized = true;
    this.zip.end();
    // Wait for all queued onData callbacks to complete
    await this.pendingWrites;
  }
}
