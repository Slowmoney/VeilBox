import type { Profile, ProfileLatency, Subscription } from '../types';

export type SortMode = 'none' | 'ping' | 'name';

export interface ProfileGroup {
  key: string;
  /** Group caption; null when there is only one group (nothing to tell apart). */
  label: string | null;
  /** The subscription this group belongs to; absent for own profiles. */
  subscription?: Subscription;
  profiles: Profile[];
}

interface GroupOptions {
  /** Caption of the own-profiles group. */
  manualLabel?: string;
  /** Keep only matching profiles (search). */
  filter?: (profile: Profile) => boolean;
  /** Keep subscriptions that have no (matching) profiles, e.g. for management screens. */
  keepEmpty?: boolean;
}

function pingScore(latency?: ProfileLatency) {
  return latency?.status === 'ok' && latency.latencyMs != null ? latency.latencyMs : Number.MAX_SAFE_INTEGER;
}

export function sortProfiles(
  profiles: Profile[],
  sortMode: SortMode,
  latencies: Record<string, ProfileLatency>,
): Profile[] {
  if (sortMode === 'none') {
    return profiles;
  }
  const sorted = [...profiles];
  if (sortMode === 'name') {
    return sorted.sort((a, b) => a.name.localeCompare(b.name));
  }
  return sorted.sort((a, b) => {
    const diff = pingScore(latencies[a.id]) - pingScore(latencies[b.id]);
    return diff !== 0 ? diff : a.name.localeCompare(b.name);
  });
}

/**
 * Profiles grouped by source: subscriptions in their order, then own profiles.
 * Sorting happens inside a group only; the selected profile is never moved.
 */
export function pickerGroups(
  profiles: Profile[],
  subscriptions: Subscription[],
  sortMode: SortMode,
  latencies: Record<string, ProfileLatency>,
  options: GroupOptions = {},
): ProfileGroup[] {
  const { manualLabel = 'Свои', filter, keepEmpty = false } = options;
  const visible = filter ? profiles.filter(filter) : profiles;
  const knownSubscriptions = new Set(subscriptions.map((subscription) => subscription.id));

  const groups: ProfileGroup[] = [];
  for (const subscription of subscriptions) {
    const own = visible.filter((profile) => profile.subscriptionId === subscription.id);
    if (own.length > 0 || (keepEmpty && !filter)) {
      groups.push({
        key: subscription.id,
        label: subscription.name,
        subscription,
        profiles: sortProfiles(own, sortMode, latencies),
      });
    }
  }

  // Own profiles, and orphans whose subscription is gone, so none get lost.
  const manual = visible.filter(
    (profile) => !profile.subscriptionId || !knownSubscriptions.has(profile.subscriptionId),
  );
  if (manual.length > 0) {
    groups.push({ key: 'manual', label: manualLabel, profiles: sortProfiles(manual, sortMode, latencies) });
  }

  return groups.length === 1 && !options.keepEmpty ? [{ ...groups[0], label: null }] : groups;
}
