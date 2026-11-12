import { describe, expect, it } from 'vitest';
import { pickerGroups } from './profileGroups';
import type { Profile, ProfileLatency, Subscription } from '../types';

function profile(id: string, name: string, subscriptionId: string | null = null): Profile {
  return {
    id,
    name,
    subscriptionId,
    source: subscriptionId ? 'subscription' : 'manual',
  } as Profile;
}

function sub(id: string, name: string): Subscription {
  return { id, name } as Subscription;
}

function ping(profileId: string, latencyMs: number | null, status: 'ok' | 'timeout' = 'ok'): ProfileLatency {
  return { profileId, latencyMs, status, checkedAt: '', message: null };
}

describe('pickerGroups', () => {
  it('returns no groups without profiles', () => {
    expect(pickerGroups([], [], 'none', {})).toEqual([]);
    expect(pickerGroups([], [sub('s1', 'A')], 'none', {})).toEqual([]);
  });

  it('orders subscriptions, then own profiles, with labels', () => {
    const groups = pickerGroups(
      [profile('m', 'Mine'), profile('b1', 'B', 's2'), profile('a1', 'A', 's1')],
      [sub('s1', 'Net A'), sub('s2', 'Net B')],
      'none',
      {},
    );
    expect(groups.map((group) => group.label)).toEqual(['Net A', 'Net B', 'Свои']);
    expect(groups.map((group) => group.profiles.map((item) => item.id))).toEqual([['a1'], ['b1'], ['m']]);
  });

  it('has no label when there is a single group', () => {
    const groups = pickerGroups([profile('a1', 'A', 's1')], [sub('s1', 'Net A')], 'none', {});
    expect(groups).toHaveLength(1);
    expect(groups[0].label).toBeNull();
  });

  it('sorts by ping with unknown last, inside a group', () => {
    const groups = pickerGroups(
      [profile('slow', 'S', 's1'), profile('none', 'N', 's1'), profile('fast', 'F', 's1')],
      [sub('s1', 'Net')],
      'ping',
      { slow: ping('slow', 200), fast: ping('fast', 40), none: ping('none', null, 'timeout') },
    );
    expect(groups[0].profiles.map((item) => item.id)).toEqual(['fast', 'slow', 'none']);
  });

  it('keeps long names intact', () => {
    const name = 'Очень длинное название сервера '.repeat(4).trim();
    const groups = pickerGroups([profile('x', name, 's1')], [sub('s1', 'Net')], 'name', {});
    expect(groups[0].profiles[0].name).toBe(name);
    expect(name.length).toBeGreaterThan(60);
  });

  it('keeps orphaned subscription profiles with the own ones', () => {
    const groups = pickerGroups([profile('o', 'Orphan', 'gone')], [], 'none', {});
    expect(groups[0].profiles.map((item) => item.id)).toEqual(['o']);
  });

  it('keeps empty subscriptions for management screens', () => {
    const groups = pickerGroups([], [sub('s1', 'Net')], 'none', {}, { keepEmpty: true });
    expect(groups.map((group) => group.key)).toEqual(['s1']);
  });
});
