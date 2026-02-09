import {
  DropgateError,
  DropgateValidationError,
  DropgateNetworkError,
  DropgateProtocolError,
  DropgateAbortError,
  DropgateTimeoutError,
} from '@dropgate/core';
import { printError, printHint, printWarning, printBlank } from './output.js';

export const EXIT_SUCCESS = 0;
export const EXIT_ERROR = 1;
export const EXIT_USAGE = 2;
export const EXIT_NETWORK = 3;
export const EXIT_PROTOCOL = 4;
export const EXIT_FS = 5;
export const EXIT_CANCELLED = 130;

export function displayError(err: unknown): number {
  if (err instanceof DropgateAbortError) {
    printWarning('Operation cancelled.');
    return EXIT_CANCELLED;
  }

  if (err instanceof DropgateValidationError) {
    printError(err.message);
    return EXIT_USAGE;
  }

  if (err instanceof DropgateNetworkError) {
    printError(err.message);
    printHint('Check that the server URL is correct and the server is running.');
    return EXIT_NETWORK;
  }

  if (err instanceof DropgateTimeoutError) {
    printError('Operation timed out.');
    printHint('Try again or check your network connection.');
    return EXIT_NETWORK;
  }

  if (err instanceof DropgateProtocolError) {
    printError(err.message);
    return EXIT_PROTOCOL;
  }

  if (err instanceof DropgateError) {
    printError(err.message);
    return EXIT_ERROR;
  }

  if (err instanceof Error) {
    if (err.message.includes('ENOENT') || err.message.includes('EACCES') || err.message.includes('EPERM')) {
      printError(err.message);
      return EXIT_FS;
    }
    printError(err.message);
    return EXIT_ERROR;
  }

  printError(String(err));
  return EXIT_ERROR;
}

export function exitUsage(message: string): never {
  printError(message);
  printHint('Run "dropgate --help" for usage information.');
  printBlank();
  process.exit(EXIT_USAGE);
}

export function exitError(message: string, code = EXIT_ERROR): never {
  printError(message);
  printBlank();
  process.exit(code);
}
