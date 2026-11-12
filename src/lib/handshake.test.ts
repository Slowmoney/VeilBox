import { describe, expect, it } from 'vitest';
import { formatAgo, formatRate, handshakeHealth } from './handshake';

const now = 1_794_500_000_000;

describe('handshakeHealth', () => {
  it('is pending while the grace period lasts', () => {
    expect(handshakeHealth(null, now - 3000, now)).toBe('pending');
  });
  it('is none when no handshake happened after the grace period', () => {
    expect(handshakeHealth(null, now - 9000, now)).toBe('none');
  });
  it('is healthy for a recent handshake', () => {
    expect(handshakeHealth(now / 1000 - 60, now - 600_000, now)).toBe('healthy');
  });
  it('is stale for an old handshake', () => {
    expect(handshakeHealth(now / 1000 - 400, now - 600_000, now)).toBe('stale');
  });
});

describe('formatAgo', () => {
  it('formats seconds, minutes and hours', () => {
    expect(formatAgo(12, 'ru')).toBe('12 с назад');
    expect(formatAgo(185, 'ru')).toBe('3 мин назад');
    expect(formatAgo(7300, 'ru')).toBe('2 ч назад');
    expect(formatAgo(12, 'en')).toBe('12 s ago');
  });
});

describe('formatRate', () => {
  it('scales units', () => {
    expect(formatRate(0)).toBe('0 B/s');
    expect(formatRate(1536)).toBe('1.5 KB/s');
    expect(formatRate(5 * 1024 * 1024)).toBe('5.0 MB/s');
  });
});
