import type { Subscription } from '../types';

export function formatBytes(value: number) {
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let size = value;
  let unit = 0;
  while (size >= 1024 && unit < units.length - 1) {
    size /= 1024;
    unit += 1;
  }
  return `${size >= 10 || unit === 0 ? Math.round(size) : size.toFixed(1)} ${units[unit]}`;
}

/** Due for auto refresh by `profile-update-interval`. */
export function isSubscriptionRefreshDue(subscription: Subscription, now = Date.now()) {
  const hours = subscription.updateIntervalHours;
  if (!hours || hours <= 0) {
    return false;
  }
  const updatedAt = new Date(subscription.updatedAt).getTime();
  return Number.isNaN(updatedAt) || now - updatedAt >= hours * 3_600_000;
}
