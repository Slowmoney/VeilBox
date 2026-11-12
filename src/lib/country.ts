export function normalizeCountryCode(code?: string | null) {
  const normalized = code?.trim().toUpperCase();
  return normalized && normalized.length === 2 ? normalized : null;
}

export function countryFlagAssetUrl(code?: string | null) {
  const normalized = normalizeCountryCode(code);
  if (!normalized) {
    return null;
  }

  return `${import.meta.env.BASE_URL}flags/${normalized.toLowerCase()}.svg`;
}

export function countryFlagFallback() {
  return String.fromCodePoint(0x1f310);
}

const REGIONAL_A = 0x1f1e6;
const REGIONAL_Z = 0x1f1ff;

/**
 * Leading flag emoji of a profile name: "🇳🇱 NL" -> { code: "NL", label: "NL" }.
 * The flag is drawn as an image next to the name; the emoji itself is dropped
 * from the label (Windows renders flag emoji as plain letters).
 */
export function splitFlagFromName(name: string): { code: string | null; label: string } {
  const trimmed = name.trimStart();
  const points = Array.from(trimmed);
  const [first, second] = points.map((char) => char.codePointAt(0) ?? 0);
  const isRegional = (point: number) => point >= REGIONAL_A && point <= REGIONAL_Z;
  if (points.length >= 2 && isRegional(first) && isRegional(second)) {
    const code = String.fromCharCode(65 + first - REGIONAL_A, 65 + second - REGIONAL_A);
    const label = points.slice(2).join('').trim();
    return { code, label: label || code };
  }
  return { code: null, label: name };
}
