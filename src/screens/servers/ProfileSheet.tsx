import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTx } from '../../lib/useTx';
import { useAppStore } from '../../store/useAppStore';
import { Confirm, Sheet, SheetAction } from '../../ui';
import { profileSubtitle, useProfileName } from '../shared/ProfileMeta';
import type { Profile } from '../../types';

interface ProfileSheetProps {
  profile: Profile | null;
  onClose: () => void;
}

/** Actions for one profile. There is no "copy link": the app cannot turn a profile back into a link. */
export function ProfileSheet({ profile, onClose }: ProfileSheetProps) {
  return profile ? <ProfileSheetBody profile={profile} onClose={onClose} /> : null;
}

function ProfileSheetBody({ profile, onClose }: { profile: Profile; onClose: () => void }) {
  const tx = useTx();
  const navigate = useNavigate();
  const language = useAppStore((state) => state.settings.language);
  const proxyOnly = useAppStore((state) => state.settings.connectionMode === 'proxyOnly');
  const status = useAppStore((state) => state.connectionStatus);
  const subscriptions = useAppStore((state) => state.subscriptions);
  const selectProfile = useAppStore((state) => state.selectProfile);
  const connect = useAppStore((state) => state.connect);
  const disconnect = useAppStore((state) => state.disconnect);
  const duplicateProfile = useAppStore((state) => state.duplicateProfile);
  const deleteProfile = useAppStore((state) => state.deleteProfile);
  const testProfileConnection = useAppStore((state) => state.testProfileConnection);
  const name = useProfileName(profile);
  const [testing, setTesting] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const source = profile.subscriptionId
    ? subscriptions.find((subscription) => subscription.id === profile.subscriptionId)?.name
    : null;
  const subtitle = [profileSubtitle(profile, proxyOnly, language), source ? tx(`из ${source}`, `from ${source}`) : null]
    .filter(Boolean)
    .join(' · ');

  const connected = status.state === 'connected';
  const isActive = connected && status.activeProfileId === profile.id;
  const busy = status.state === 'connecting';

  const onConnect = async () => {
    onClose();
    if (isActive) {
      await disconnect();
      return;
    }
    // Connected elsewhere: selecting reconnects. Otherwise select, then connect.
    await selectProfile(profile.id);
    if (!connected) {
      await connect(profile.id);
    }
    navigate('/');
  };

  const onTest = async () => {
    setTesting(true);
    try {
      await testProfileConnection(profile.id);
    } finally {
      setTesting(false);
      onClose();
    }
  };

  return (
    <>
      <Sheet open={!confirmOpen} onClose={onClose} title={name} subtitle={subtitle}>
        <SheetAction disabled={busy} onClick={() => void onConnect()}>
          {isActive ? tx('Отключиться', 'Disconnect') : tx('Подключиться', 'Connect')}
        </SheetAction>
        <SheetAction disabled={testing || busy} onClick={() => void onTest()}>
          {testing ? tx('Проверяю…', 'Checking…') : tx('Проверить', 'Test')}
        </SheetAction>
        <SheetAction
          onClick={() => {
            onClose();
            navigate(`/servers/profile/${profile.id}`);
          }}
        >
          {tx('Подробнее и изменить', 'Details and edit')}
        </SheetAction>
        <SheetAction
          onClick={() => {
            onClose();
            void duplicateProfile(profile.id);
          }}
        >
          {tx('Дублировать', 'Duplicate')}
        </SheetAction>
        <SheetAction danger onClick={() => setConfirmOpen(true)}>
          {tx('Удалить', 'Delete')}
        </SheetAction>
      </Sheet>
      <Confirm
        open={confirmOpen}
        title={tx(`Удалить «${name}»?`, `Delete "${name}"?`)}
        confirmLabel={tx('Удалить', 'Delete')}
        onClose={() => {
          setConfirmOpen(false);
          onClose();
        }}
        onConfirm={() => void deleteProfile(profile.id)}
      />
    </>
  );
}
