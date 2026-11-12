import { MoreHorizontal } from 'lucide-react';
import { useAppStore } from '../../store/useAppStore';
import { IconButton, Row } from '../../ui';
import { Ping, ProfileFlag, profileSubtitle, useProfileName } from '../shared/ProfileMeta';
import type { Profile } from '../../types';

interface ProfileRowProps {
  profile: Profile;
  selected: boolean;
  onOpen: () => void;
}

/** Management row: tapping it or "⋯" opens the profile's action sheet. */
export function ProfileRow({ profile, selected, onOpen }: ProfileRowProps) {
  const language = useAppStore((state) => state.settings.language);
  const proxyOnly = useAppStore((state) => state.settings.connectionMode === 'proxyOnly');
  const name = useProfileName(profile);

  return (
    <Row
      selected={selected}
      leading={<ProfileFlag profile={profile} />}
      title={name}
      subtitle={profileSubtitle(profile, proxyOnly, language)}
      value={<Ping profileId={profile.id} />}
      onClick={onOpen}
      trailing={
        <IconButton
          aria-label="⋯"
          onClick={(event) => {
            event.stopPropagation();
            onOpen();
          }}
        >
          <MoreHorizontal size={18} />
        </IconButton>
      }
    />
  );
}
