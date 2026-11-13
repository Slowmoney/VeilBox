import { describe, expect, it } from 'vitest';
import type { Profile } from '../types';
import { configServerCount, protocolLine } from './profileText';

const base = {
  engine: 'xray',
  protocol: 'vless',
  networkType: 'tcp',
  securityType: 'reality',
} as unknown as Profile;

const withConfig = (outbounds: unknown[]) =>
  ({ ...base, xrayConfig: JSON.stringify({ outbounds }) }) as Profile;

describe('protocolLine for subscription configs', () => {
  it('a plain profile keeps its single line', () => {
    expect(protocolLine(base)).toBe('VLESS · Reality');
  });

  it('a balanced config of one kind shows the server count', () => {
    const profile = withConfig([
      { protocol: 'vless', streamSettings: { network: 'tcp' } },
      { protocol: 'vless', streamSettings: { network: 'tcp' } },
      { protocol: 'freedom' },
      { protocol: 'blackhole' },
    ]);
    expect(configServerCount(profile)).toEqual({ count: 2, mixed: false });
    expect(protocolLine(profile)).toBe('VLESS · Reality · ×2');
  });

  it('a mixed config (АВТОВЫБОР) is labelled as automatic', () => {
    const profile = withConfig([
      { protocol: 'hysteria' },
      { protocol: 'vless', streamSettings: { network: 'tcp' } },
      { protocol: 'vless', streamSettings: { network: 'xhttp' } },
    ]);
    expect(protocolLine(profile)).toBe('Авто ×3');
  });

  it('broken config JSON falls back to the plain line', () => {
    expect(protocolLine({ ...base, xrayConfig: '{oops' } as Profile)).toBe('VLESS · Reality');
  });
});
