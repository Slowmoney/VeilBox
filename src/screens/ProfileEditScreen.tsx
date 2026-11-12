import { Navigate, useNavigate, useParams } from 'react-router-dom';
import { AmneziaProfileForm } from '../features/profiles/AmneziaProfileForm';
import { ProfileForm } from '../features/profiles/ProfileForm';
import { useTx } from '../lib/useTx';
import { useAppStore } from '../store/useAppStore';
import { Screen } from '../ui';
import type { Profile } from '../types';

/** Details and editing of one profile; `/servers/profile/new` creates an own profile. */
export function ProfileEditScreen() {
  const tx = useTx();
  const navigate = useNavigate();
  const { id } = useParams();
  const initialized = useAppStore((state) => state.initialized);
  const profile = useAppStore((state) => state.profiles.find((item) => item.id === id) ?? null);
  const saveProfile = useAppStore((state) => state.saveProfile);

  const creating = id === 'new';
  if (!creating && !profile) {
    // Profiles are still loading at launch; afterwards a missing id means it was deleted.
    return initialized ? <Navigate to="/servers" replace /> : null;
  }

  const back = () => navigate('/servers');
  const save = async (draft: Partial<Profile>) => {
    await saveProfile(draft);
    back();
  };

  return (
    <Screen title={creating ? tx('Новый сервер', 'New server') : tx('Сервер', 'Server')} back="/servers">
      {profile?.engine === 'amneziawg' ? (
        <AmneziaProfileForm profile={profile} onSave={save} onCancel={back} />
      ) : (
        <ProfileForm profile={creating ? null : profile} onSave={save} onCancel={back} />
      )}
    </Screen>
  );
}
