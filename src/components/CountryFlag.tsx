import { useState } from 'react';
import { countryFlagAssetUrl, normalizeCountryCode } from '../lib/country';

interface CountryFlagProps {
  code?: string | null;
  title?: string;
}

/** Flag from public/flags (Windows does not render flag emoji); a plain code as fallback. */
export function CountryFlag({ code, title }: CountryFlagProps) {
  const normalized = normalizeCountryCode(code);
  const src = countryFlagAssetUrl(normalized);
  const [failedSource, setFailedSource] = useState<string | null>(null);

  return (
    <span className="ui-flag" title={title}>
      {src && failedSource !== src ? (
        <img src={src} alt="" draggable={false} onError={() => setFailedSource(src)} />
      ) : (
        (normalized ?? '··')
      )}
    </span>
  );
}
