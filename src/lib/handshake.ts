import type { AppLanguage } from '../types';

export type HandshakeHealth = 'pending' | 'healthy' | 'stale' | 'none';

/** Right after connecting the first handshake may still be on its way. */
export const HANDSHAKE_GRACE_MS = 8000;
/** WireGuard re-handshakes about every 2 minutes; up to 3 minutes is healthy. */
export const HANDSHAKE_HEALTHY_MS = 180_000;

/**
 * Health of an AmneziaWG tunnel from its last handshake.
 * `latestHandshakeAt` is unix seconds (null: none yet); `connectedAt` and `now` are ms.
 */
export function handshakeHealth(
  latestHandshakeAt: number | null,
  connectedAt: number,
  now: number,
): HandshakeHealth {
  if (latestHandshakeAt == null) {
    return now - connectedAt < HANDSHAKE_GRACE_MS ? 'pending' : 'none';
  }
  return now - latestHandshakeAt * 1000 <= HANDSHAKE_HEALTHY_MS ? 'healthy' : 'stale';
}

/** "12 с назад" / "3 мин назад" / "2 ч назад". */
export function formatAgo(seconds: number, language: AppLanguage = 'ru'): string {
  const value = Math.max(0, Math.floor(seconds));
  const ru = language === 'ru';
  if (value < 60) {
    return ru ? `${value} с назад` : `${value} s ago`;
  }
  if (value < 3600) {
    const minutes = Math.floor(value / 60);
    return ru ? `${minutes} мин назад` : `${minutes} min ago`;
  }
  const hours = Math.floor(value / 3600);
  return ru ? `${hours} ч назад` : `${hours} h ago`;
}

/** Bytes per second as "1.2 MB/s". */
export function formatRate(bytesPerSecond: number): string {
  const units = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
  let size = Math.max(0, bytesPerSecond);
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size >= 10 || unit === 0 ? Math.round(size) : size.toFixed(1)} ${units[unit]}`;
}
