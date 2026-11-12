import { useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { pickerGroups } from '../../lib/profileGroups';
import { useSortMode } from '../../lib/sortMode';
import { useTx } from '../../lib/useTx';
import { useAppStore } from '../../store/useAppStore';
import { Button, ListGroup, Row } from '../../ui';
import { Ping, ProfileFlag, profileSubtitle, useProfileName } from '../shared/ProfileMeta';
import type { Profile } from '../../types';

function PickerRow({ profile, selected }: { profile: Profile; selected: boolean }) {
  const language = useAppStore((state) => state.settings.language);
  const proxyOnly = useAppStore((state) => state.settings.connectionMode === 'proxyOnly');
  const selectProfile = useAppStore((state) => state.selectProfile);
  const name = useProfileName(profile);

  return (
    <Row
      selected={selected}
      leading={<ProfileFlag profile={profile} />}
      title={name}
      subtitle={profileSubtitle(profile, proxyOnly, language)}
      value={<Ping profileId={profile.id} />}
      onClick={() => void selectProfile(profile.id)}
    />
  );
}

/** Pick a server: all profiles, grouped by source, in the order chosen on Серверы. */
export function ServerPicker() {
  const tx = useTx();
  const navigate = useNavigate();
  const profiles = useAppStore((state) => state.profiles);
  const subscriptions = useAppStore((state) => state.subscriptions);
  const latencies = useAppStore((state) => state.latencies);
  const selectedProfileId = useAppStore((state) => state.selectedProfileId);
  const [sortMode] = useSortMode();
  const manualLabel = tx('Свои', 'Own');

  // Bring the selected server into view when the screen opens (long lists).
  useEffect(() => {
    document.querySelector('.ui-row.is-selected')?.scrollIntoView({ block: 'nearest' });
  }, []);

  const groups = useMemo(
    () => pickerGroups(profiles, subscriptions, sortMode, latencies, { manualLabel }),
    [profiles, subscriptions, sortMode, latencies, manualLabel],
  );

  if (groups.length === 0) {
    return (
      <div className="ui-empty">
        <p>{tx('Серверов пока нет', 'No servers yet')}</p>
        <Button onClick={() => navigate('/servers', { state: { add: true } })}>
          {tx('Добавить сервер', 'Add a server')}
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="ui-label">{tx('Сервер', 'Server')}</div>
      {groups.map((group) => (
        <div key={group.key} className="picker-group">
          {group.label ? <div className="picker-source">{group.label}</div> : null}
          <ListGroup cards>
            {group.profiles.map((profile) => (
              <PickerRow key={profile.id} profile={profile} selected={profile.id === selectedProfileId} />
            ))}
          </ListGroup>
        </div>
      ))}
    </>
  );
}
