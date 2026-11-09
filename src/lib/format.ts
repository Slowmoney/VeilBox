import { t } from './i18n';
import type { AppLanguage, Profile, ProfileLatency, Subscription } from '../types';

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

/** Traffic and expiry from the `subscription-userinfo` header, or null when absent. */
export function subscriptionUsageLabel(subscription: Subscription, language: AppLanguage = 'ru') {
  const parts: string[] = [];
  const used = (subscription.upload ?? 0) + (subscription.download ?? 0);
  if (subscription.total) {
    parts.push(`${formatBytes(used)} / ${formatBytes(subscription.total)}`);
  } else if (subscription.upload != null || subscription.download != null) {
    parts.push(formatBytes(used));
  }
  if (subscription.expireAt) {
    const expire = new Date(subscription.expireAt);
    if (!Number.isNaN(expire.getTime())) {
      const expired = expire.getTime() <= Date.now();
      parts.push(
        `${t(language, expired ? 'subscriptionExpired' : 'subscriptionExpiresAt')} ${expire.toLocaleDateString()}`,
      );
    }
  }
  return parts.length > 0 ? parts.join(' · ') : null;
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

export function formatTimestamp(value: string | null, language: AppLanguage = 'ru') {
  if (!value) {
    return t(language, 'unavailable');
  }

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export function maskSecret(value: string | null, visible = 4, language: AppLanguage = 'ru') {
  if (!value) {
    return t(language, 'notSet');
  }

  if (value.length <= visible * 2) {
    return `${value.slice(0, 2)}***`;
  }

  return `${value.slice(0, visible)}****${value.slice(-visible)}`;
}

export function profileSubtitle(profile: Profile) {
  if (profile.engine === 'amneziawg') {
    return `${profile.serverAddress}:${profile.port} / AMNEZIAWG`;
  }
  if (profile.protocol && profile.protocol !== 'vless') {
    return `${profile.serverAddress}:${profile.port} / ${profile.protocol.toUpperCase()}`;
  }
  return `${profile.serverAddress}:${profile.port} / ${profile.networkType.toUpperCase()} / ${profile.securityType.toUpperCase()}`;
}

export function profileTransportLabel(profile: Profile) {
  if (profile.engine === 'amneziawg') {
    return 'AMNEZIAWG';
  }
  if (profile.protocol && profile.protocol !== 'vless') {
    return profile.protocol.toUpperCase();
  }
  return `${profile.networkType.toUpperCase()}/${profile.securityType.toUpperCase()}`;
}

export function statusLabel(state: string, language: AppLanguage = 'ru') {
  switch (state) {
    case 'connected':
      return t(language, 'connected');
    case 'connecting':
      return t(language, 'connecting');
    case 'error':
      return t(language, 'error');
    default:
      return t(language, 'disconnected');
  }
}

export function formatLatency(latency?: ProfileLatency | null, language: AppLanguage = 'ru') {
  if (!latency) {
    return t(language, 'checking');
  }

  switch (latency.status) {
    case 'ok':
      return `${latency.latencyMs ?? 0} ms`;
    case 'timeout':
      return t(language, 'timeout');
    default:
      return t(language, 'unavailable');
  }
}
