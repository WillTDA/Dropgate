import { describe, it, expect, vi } from 'vitest';
import {
  DropgateError,
  DropgateValidationError,
  DropgateNetworkError,
  DropgateProtocolError,
  DropgateAbortError,
  DropgateTimeoutError,
} from '@dropgate/core';
import {
  displayError,
  EXIT_SUCCESS,
  EXIT_ERROR,
  EXIT_USAGE,
  EXIT_NETWORK,
  EXIT_PROTOCOL,
  EXIT_FS,
  EXIT_CANCELLED,
} from '../src/lib/errors.js';

describe('exit codes', () => {
  it('has correct values', () => {
    expect(EXIT_SUCCESS).toBe(0);
    expect(EXIT_ERROR).toBe(1);
    expect(EXIT_USAGE).toBe(2);
    expect(EXIT_NETWORK).toBe(3);
    expect(EXIT_PROTOCOL).toBe(4);
    expect(EXIT_FS).toBe(5);
    expect(EXIT_CANCELLED).toBe(130);
  });
});

describe('displayError', () => {
  // Suppress console output during tests
  beforeEach(() => {
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('returns EXIT_CANCELLED for DropgateAbortError', () => {
    expect(displayError(new DropgateAbortError())).toBe(EXIT_CANCELLED);
  });

  it('returns EXIT_USAGE for DropgateValidationError', () => {
    expect(displayError(new DropgateValidationError('bad input'))).toBe(EXIT_USAGE);
  });

  it('returns EXIT_NETWORK for DropgateNetworkError', () => {
    expect(displayError(new DropgateNetworkError('connection failed'))).toBe(EXIT_NETWORK);
  });

  it('returns EXIT_NETWORK for DropgateTimeoutError', () => {
    expect(displayError(new DropgateTimeoutError())).toBe(EXIT_NETWORK);
  });

  it('returns EXIT_PROTOCOL for DropgateProtocolError', () => {
    expect(displayError(new DropgateProtocolError('bad response'))).toBe(EXIT_PROTOCOL);
  });

  it('returns EXIT_ERROR for generic DropgateError', () => {
    expect(displayError(new DropgateError('something went wrong'))).toBe(EXIT_ERROR);
  });

  it('returns EXIT_FS for ENOENT errors', () => {
    expect(displayError(new Error('ENOENT: no such file or directory'))).toBe(EXIT_FS);
  });

  it('returns EXIT_FS for EACCES errors', () => {
    expect(displayError(new Error('EACCES: permission denied'))).toBe(EXIT_FS);
  });

  it('returns EXIT_FS for EPERM errors', () => {
    expect(displayError(new Error('EPERM: operation not permitted'))).toBe(EXIT_FS);
  });

  it('returns EXIT_ERROR for generic errors', () => {
    expect(displayError(new Error('unknown error'))).toBe(EXIT_ERROR);
  });

  it('returns EXIT_ERROR for non-Error objects', () => {
    expect(displayError('string error')).toBe(EXIT_ERROR);
    expect(displayError(42)).toBe(EXIT_ERROR);
    expect(displayError(null)).toBe(EXIT_ERROR);
  });
});
