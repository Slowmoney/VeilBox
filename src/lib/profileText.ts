import { splitFlagFromName } from './country';
import { tx } from './text';
import type { AppLanguage, Profile, ProfileCountry, ProfileLatency } from '../types';

const NETWORK_LABEL: Record<string, string> = {
  xhttp: 'XHTTP',
  ws: 'WebSocket',
  grpc: 'gRPC',
  httpupgrade: 'HTTPUpgrade',
  kcp: 'mKCP',
};

const PROXY_PROTOCOLS = new Set(['vless', 'vmess', 'trojan', 'shadowsocks', 'hysteria']);

/** Servers inside a subscription config (its balancer picks among them). */
export function configServerCount(profile: Profile): { count: number; mixed: boolean } {
  if (!profile.xrayConfig) return { count: 1, mixed: false };
  try {
    const config = JSON.parse(profile.xrayConfig) as { outbounds?: { protocol?: string; streamSettings?: { network?: string } }[] };
    const proxies = (config.outbounds ?? []).filter((outbound) => PROXY_PROTOCOLS.has(outbound.protocol ?? ''));
    const kinds = new Set(proxies.map((outbound) => `${outbound.protocol}/${outbound.streamSettings?.network ?? ''}`));
    return { count: proxies.length, mixed: kinds.size > 1 };
  } catch {
    return { count: 1, mixed: false };
  }
}

/** Short protocol line of a profile: "VLESS · Reality", "XHTTP · Reality", "AmneziaWG";
 *  subscription configs add the server count: "VLESS · Reality · ×2", mixed ones "Авто ×8". */
export function protocolLine(profile: Profile): string {
  const base = singleProtocolLine(profile);
  const { count, mixed } = configServerCount(profile);
  if (!profile.xrayConfig || count <= 1) return base;
  return mixed ? `Авто ×${count}` : `${base} · ×${count}`;
}

function singleProtocolLine(profile: Profile): string {
  if (profile.engine === 'amneziawg') {
    return 'AmneziaWG';
  }
  if (profile.protocol === 'hysteria2') {
    return 'Hysteria2';
  }
  if (profile.protocol === 'shadowsocks') {
    return 'Shadowsocks';
  }
  const transport = NETWORK_LABEL[profile.networkType] ?? 'VLESS';
  const security = profile.securityType === 'reality' ? 'Reality' : profile.securityType === 'tls' ? 'TLS' : null;
  return security ? `${transport} · ${security}` : transport;
}

/** Name without the flag emoji, and the country code to draw the flag from. */
export function profileIdentity(profile: Profile, country?: ProfileCountry | null) {
  const { code, label } = splitFlagFromName(profile.name);
  return { name: label, flag: code ?? country?.countryCode ?? null };
}

export interface PingView {
  text: string;
  tone: 'ok' | 'warn' | 'bad' | 'none';
}

/** Latency as shown in lists: "45 ms", "—" while unknown, "нет ответа" on failure. */
export function pingView(latency: ProfileLatency | undefined, language: AppLanguage): PingView {
  if (!latency) {
    return { text: '…', tone: 'none' };
  }
  if (latency.status === 'ok' && latency.latencyMs != null) {
    const ms = latency.latencyMs;
    return { text: `${ms} ms`, tone: ms > 400 ? 'warn' : 'ok' };
  }
  return { text: tx(language, 'нет ответа', 'no reply'), tone: 'bad' };
}
