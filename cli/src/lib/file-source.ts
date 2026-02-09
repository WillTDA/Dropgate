import fs from 'node:fs';
import path from 'node:path';
import type { FileSource } from '@dropgate/core';

export class NodeFileSource implements FileSource {
  readonly name: string;
  readonly size: number;
  readonly type: string;
  private _path: string;
  private _start: number;
  private _end: number;

  constructor(filePath: string) {
    this._path = path.resolve(filePath);
    const stat = fs.statSync(this._path);
    if (!stat.isFile()) throw new Error(`Not a file: ${this._path}`);
    this.name = path.basename(this._path);
    this.size = stat.size;
    this.type = 'application/octet-stream';
    this._start = 0;
    this._end = this.size;
  }

  private static _fromSlice(
    filePath: string,
    name: string,
    size: number,
    start: number,
    end: number,
  ): NodeFileSource {
    const source = Object.create(NodeFileSource.prototype) as NodeFileSource;
    source._path = filePath;
    (source as { name: string }).name = name;
    (source as { size: number }).size = size;
    (source as { type: string }).type = 'application/octet-stream';
    source._start = start;
    source._end = end;
    return source;
  }

  slice(start: number, end: number): FileSource {
    const absStart = this._start + start;
    const absEnd = this._start + end;
    return NodeFileSource._fromSlice(this._path, this.name, absEnd - absStart, absStart, absEnd);
  }

  async arrayBuffer(): Promise<ArrayBuffer> {
    const fd = fs.openSync(this._path, 'r');
    try {
      const length = this._end - this._start;
      const buffer = Buffer.alloc(length);
      fs.readSync(fd, buffer, 0, length, this._start);
      return buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);
    } finally {
      fs.closeSync(fd);
    }
  }
}
