import { describe, it, expect } from 'vitest';
import {
  formatBytes,
  formatSpeed,
  formatEta,
  formatDuration,
  formatLifetimeHuman,
  formatCount,
  pluralize,
} from '../src/lib/format.js';

describe('formatBytes', () => {
  it('formats zero bytes', () => {
    expect(formatBytes(0)).toBe('0 B');
  });

  it('formats bytes', () => {
    expect(formatBytes(500)).toBe('500 B');
  });

  it('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1.00 KB');
    expect(formatBytes(1536)).toBe('1.50 KB');
  });

  it('formats megabytes', () => {
    expect(formatBytes(1048576)).toBe('1.00 MB');
    expect(formatBytes(5242880)).toBe('5.00 MB');
  });

  it('formats gigabytes', () => {
    expect(formatBytes(1073741824)).toBe('1.00 GB');
  });

  it('formats terabytes', () => {
    expect(formatBytes(1099511627776)).toBe('1.00 TB');
  });

  it('rounds appropriately based on magnitude', () => {
    // < 10: 2 decimal places
    expect(formatBytes(1024)).toBe('1.00 KB');
    // < 100: 1 decimal place
    expect(formatBytes(50 * 1024)).toBe('50.0 KB');
    // >= 100: no decimals
    expect(formatBytes(500 * 1024)).toBe('500 KB');
  });
});

describe('formatSpeed', () => {
  it('formats bytes per second', () => {
    expect(formatSpeed(1024)).toBe('1.00 KB/s');
    expect(formatSpeed(5242880)).toBe('5.00 MB/s');
  });

  it('formats zero speed', () => {
    expect(formatSpeed(0)).toBe('0 B/s');
  });
});

describe('formatEta', () => {
  it('formats seconds', () => {
    expect(formatEta(5)).toBe('0:05');
    expect(formatEta(30)).toBe('0:30');
    expect(formatEta(59)).toBe('0:59');
  });

  it('formats minutes', () => {
    expect(formatEta(60)).toBe('1:00');
    expect(formatEta(90)).toBe('1:30');
    expect(formatEta(3599)).toBe('59:59');
  });

  it('formats hours', () => {
    expect(formatEta(3600)).toBe('1:00:00');
    expect(formatEta(7261)).toBe('2:01:01');
  });

  it('handles non-finite values', () => {
    expect(formatEta(Infinity)).toBe('--:--');
    expect(formatEta(-Infinity)).toBe('--:--');
    expect(formatEta(NaN)).toBe('--:--');
  });

  it('handles negative values', () => {
    expect(formatEta(-1)).toBe('--:--');
  });

  it('ceils fractional seconds', () => {
    expect(formatEta(0.1)).toBe('0:01');
    expect(formatEta(59.9)).toBe('1:00');
  });
});

describe('formatDuration', () => {
  it('formats milliseconds', () => {
    expect(formatDuration(500)).toBe('500ms');
    expect(formatDuration(999)).toBe('999ms');
  });

  it('formats seconds', () => {
    expect(formatDuration(1000)).toBe('1.0s');
    expect(formatDuration(5500)).toBe('5.5s');
    expect(formatDuration(59000)).toBe('59.0s');
  });

  it('formats minutes', () => {
    expect(formatDuration(60000)).toBe('1m 0s');
    expect(formatDuration(90000)).toBe('1m 30s');
  });

  it('formats hours', () => {
    expect(formatDuration(3600000)).toBe('1h 0m');
    expect(formatDuration(7230000)).toBe('2h 0m');
  });
});

describe('formatLifetimeHuman', () => {
  it('formats unlimited', () => {
    expect(formatLifetimeHuman(0)).toBe('Unlimited');
    expect(formatLifetimeHuman(-1)).toBe('Unlimited');
  });

  it('formats minutes', () => {
    expect(formatLifetimeHuman(30 * 60 * 1000)).toBe('30 minutes');
  });

  it('formats hours', () => {
    expect(formatLifetimeHuman(3600000)).toBe('1 hour');
    expect(formatLifetimeHuman(7200000)).toBe('2 hours');
  });

  it('formats days', () => {
    expect(formatLifetimeHuman(86400000)).toBe('1 day');
    expect(formatLifetimeHuman(7 * 86400000)).toBe('7 days');
  });
});

describe('formatCount', () => {
  it('formats unlimited', () => {
    expect(formatCount(0)).toBe('Unlimited');
    expect(formatCount(-1)).toBe('Unlimited');
  });

  it('formats positive numbers', () => {
    expect(formatCount(1)).toBe('1');
    expect(formatCount(100)).toBe('100');
  });
});

describe('pluralize', () => {
  it('returns singular for count of 1', () => {
    expect(pluralize(1, 'file')).toBe('file');
  });

  it('returns plural for count not 1', () => {
    expect(pluralize(0, 'file')).toBe('files');
    expect(pluralize(2, 'file')).toBe('files');
    expect(pluralize(100, 'file')).toBe('files');
  });

  it('uses custom plural form', () => {
    expect(pluralize(2, 'index', 'indices')).toBe('indices');
    expect(pluralize(1, 'index', 'indices')).toBe('index');
  });
});
