import { useEffect, useState } from 'react';
import { useTx } from '../../lib/useTx';
import { Button, Field, Input, TextArea } from '../../ui';
import type { Profile } from '../../types';

interface AmneziaProfileFormProps {
  profile?: Profile | null;
  onSave: (draft: Partial<Profile>) => Promise<void>;
  onCancel: () => void;
}

export function AmneziaProfileForm({ profile, onSave, onCancel }: AmneziaProfileFormProps) {
  const [name, setName] = useState(profile?.name ?? '');
  const [saving, setSaving] = useState(false);
  const tx = useTx();

  useEffect(() => {
    setName(profile?.name ?? '');
  }, [profile]);

  if (!profile?.amneziaConfig) {
    return null;
  }

  const submit = async () => {
    setSaving(true);
    try {
      await onSave({
        id: profile.id,
        engine: 'amneziawg',
        protocol: profile.protocol,
        password: profile.password,
        method: profile.method,
        obfsPassword: profile.obfsPassword,
        name: name.trim() || profile.name,
        serverAddress: profile.serverAddress,
        port: profile.port,
        uuid: profile.uuid,
        networkType: profile.networkType,
        securityType: profile.securityType,
        flow: profile.flow,
        sni: profile.sni,
        fingerprint: profile.fingerprint,
        publicKey: profile.publicKey,
        shortId: profile.shortId,
        spiderX: profile.spiderX,
        path: profile.path,
        hostHeader: profile.hostHeader,
        serviceName: profile.serviceName,
        xhttpMode: profile.xhttpMode,
        transportHeaderType: profile.transportHeaderType,
        seed: profile.seed,
        alpn: profile.alpn,
        allowInsecure: profile.allowInsecure,
        remark: profile.remark,
        source: profile.source,
        sourceLabel: profile.sourceLabel,
        subscriptionId: profile.subscriptionId,
        amneziaConfig: profile.amneziaConfig,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="ui-form">
      <Field label={tx('Название', 'Name')}>
        <Input value={name} onChange={(event) => setName(event.target.value)} />
      </Field>

      <Field label={tx('Сервер', 'Server')}>
        <Input value={`${profile.serverAddress}:${profile.port}`} readOnly />
      </Field>

      <Field label={tx('Конфиг', 'Config')}>
        <TextArea mono rows={12} value={profile.amneziaConfig.rawConfig} readOnly />
      </Field>

      <div className="ui-actions">
        <Button block onClick={() => void submit()} disabled={saving}>
          {saving ? tx('Сохранение…', 'Saving…') : tx('Сохранить', 'Save')}
        </Button>
        <Button variant="secondary" block onClick={onCancel}>
          {tx('Отмена', 'Cancel')}
        </Button>
      </div>
    </div>
  );
}
