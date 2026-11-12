export type ImportKind =
  | 'subscription'
  | 'proxyUri'
  | 'amneziaUri'
  | 'amneziaConfig'
  | 'json'
  | 'unknown';

/** Decides which import action handles pasted text. Callers switch on the kind. */
export function detectImportKind(input: string): ImportKind {
  const text = input.trim();
  if (!text) {
    return 'unknown';
  }
  if (/^(vless|ss|hy2|hysteria2):\/\//i.test(text)) {
    return 'proxyUri';
  }
  if (/^https?:\/\//i.test(text)) {
    return 'subscription';
  }
  if (/^(?:amnezia\s+)?vpn:\/\//i.test(text)) {
    return 'amneziaUri';
  }
  if (/\[interface\]/i.test(text) && /\[peer\]/i.test(text)) {
    return 'amneziaConfig';
  }
  if (text.startsWith('{') || text.startsWith('[')) {
    try {
      JSON.parse(text);
      return 'json';
    } catch {
      return 'unknown';
    }
  }
  return 'unknown';
}
