import { CountryFlag } from '../../components/CountryFlag';
import { pingView, profileIdentity, protocolLine } from '../../lib/profileText';
import { tx } from '../../lib/text';
import { useAppStore } from '../../store/useAppStore';
import type { AppLanguage, Profile } from '../../types';

/** Flag of a profile: from the emoji in its name, else the resolved country. */
export function ProfileFlag({ profile }: { profile: Profile }) {
  const country = useAppStore((state) => state.profileCountries[profile.id]);
  const { flag } = profileIdentity(profile, country);
  return <CountryFlag code={flag} title={country?.countryName ?? undefined} />;
}

export function useProfileName(profile: Profile) {
  const country = useAppStore((state) => state.profileCountries[profile.id]);
  return profileIdentity(profile, country).name;
}

/** "VLESS · Reality", plus "туннель" for AmneziaWG while in proxy-only mode. */
export function profileSubtitle(profile: Profile, proxyOnly: boolean, language: AppLanguage) {
  const line = protocolLine(profile);
  return profile.engine === 'amneziawg' && proxyOnly ? `${line} · ${tx(language, 'туннель', 'tunnel')}` : line;
}

export function Ping({ profileId }: { profileId: string }) {
  const latency = useAppStore((state) => state.latencies[profileId]);
  const language = useAppStore((state) => state.settings.language);
  const view = pingView(latency, language);
  return (
    <span className={`ping ping--${view.tone}`} title={latency?.message ?? undefined}>
      {view.text}
    </span>
  );
}
