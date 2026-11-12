import type { ConnectionMode, SplitTunnelMode } from '../types';

export const LOCAL_NETWORK_DOMAINS = ['localhost', 'local', 'home.arpa'];
export const LOCAL_NETWORK_IPS = [
  '127.0.0.0/8',
  '10.0.0.0/8',
  '172.16.0.0/12',
  '192.168.0.0/16',
  '169.254.0.0/16',
];
export const STREAMING_DOMAINS = [
  'netflix.com',
  'youtube.com',
  'twitch.tv',
  'spotify.com',
  'disneyplus.com',
  'hulu.com',
];
export const AI_DOMAINS = [
  'chatgpt.com',
  'openai.com',
  'oaistatic.com',
  'oaiusercontent.com',
  'claude.ai',
  'anthropic.com',
  'perplexity.ai',
  'gemini.google.com',
  'copilot.microsoft.com',
  'grok.com',
];
export const CODEX_DOMAINS = ['chatgpt.com', 'openai.com', 'oaistatic.com', 'oaiusercontent.com'];

export interface SplitPreset {
  key: string;
  label: { ru: string; en: string };
  domains: string[];
  ips: string[];
}

const BASE_PRESETS: SplitPreset[] = [
  { key: 'local', label: { ru: 'Локальные сети', en: 'Local networks' }, domains: LOCAL_NETWORK_DOMAINS, ips: LOCAL_NETWORK_IPS },
  { key: 'streaming', label: { ru: 'Стриминг', en: 'Streaming' }, domains: STREAMING_DOMAINS, ips: [] },
  { key: 'ai', label: { ru: 'AI-сервисы', en: 'AI services' }, domains: AI_DOMAINS, ips: [] },
];

const CODEX_PRESET: SplitPreset = {
  key: 'codex',
  label: { ru: 'Codex', en: 'Codex' },
  domains: CODEX_DOMAINS,
  ips: [],
};

export const GEO_TUN_PRESETS: SplitPreset[] = [
  { key: 'geoip:ru', label: { ru: 'Сайты РФ напрямую', en: 'Russian sites direct' }, domains: ['domain:ru', 'domain:рф', 'domain:su'], ips: ['geoip:ru'] },
  { key: 'geosite:private', label: { ru: 'Geo private', en: 'Geo private' }, domains: ['geosite:private'], ips: ['geoip:private'] },
  { key: 'geosite:category-ads-all', label: { ru: 'Geo ads', en: 'Geo ads' }, domains: ['geosite:category-ads-all'], ips: [] },
  { key: 'geosite:netflix', label: { ru: 'Geo Netflix', en: 'Geo Netflix' }, domains: ['geosite:netflix'], ips: [] },
  { key: 'geosite:google', label: { ru: 'Geo Google', en: 'Geo Google' }, domains: ['geosite:google'], ips: ['geoip:google'] },
  { key: 'geosite:telegram', label: { ru: 'Geo Telegram', en: 'Geo Telegram' }, domains: ['geosite:telegram'], ips: ['geoip:telegram'] },
];

/** Presets offered for the current mode (same visibility rules as before the redesign). */
export function visiblePresets(connectionMode: ConnectionMode, splitMode: SplitTunnelMode): SplitPreset[] {
  const presets = [...BASE_PRESETS];
  if (splitMode === 'proxyListed') {
    presets.push(CODEX_PRESET);
  }
  if (connectionMode === 'tun') {
    presets.push(
      ...GEO_TUN_PRESETS.filter((preset) => preset.key !== 'geoip:ru' || splitMode === 'bypassListed'),
    );
  }
  return presets;
}

export function mergeUnique(current: string[], items: string[]) {
  return Array.from(new Set([...current, ...items]));
}

/** Settings patch that adds a preset to the current lists (one-shot, never removes). */
export function applyPreset(current: { domains: string[]; ips: string[] }, preset: SplitPreset) {
  return {
    splitTunnelDomains: mergeUnique(current.domains, preset.domains),
    splitTunnelIps: mergeUnique(current.ips, preset.ips),
  };
}
