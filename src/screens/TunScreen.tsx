import { useEffect, useState } from 'react';
import { backend } from '../lib/tauri';
import { useTx } from '../lib/useTx';
import { useAppStore } from '../store/useAppStore';
import { Field, Input, ListGroup, Row, Screen, Select, Switch } from '../ui';
import type { NetworkInterfaceInfo } from '../types';

export function TunScreen() {
  const tx = useTx();
  const settings = useAppStore((state) => state.settings);
  const saveSettings = useAppStore((state) => state.saveSettings);
  const [nameDraft, setNameDraft] = useState(settings.tunInterfaceName);
  const [adapters, setAdapters] = useState<NetworkInterfaceInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setNameDraft(settings.tunInterfaceName);
  }, [settings.tunInterfaceName]);

  useEffect(() => {
    let alive = true;
    backend
      .listNetworkInterfaces()
      .then((items) => alive && setAdapters(items))
      .catch(() => alive && setFailed(true))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const save = (patch: Parameters<typeof saveSettings>[0]) => void saveSettings(patch, { silent: true });
  const known = adapters.some((adapter) => adapter.name === settings.tunOutboundInterface);

  return (
    <Screen title="TUN" back="/settings">
      <div className="ui-form">
        <Field label={tx('Имя интерфейса', 'Interface name')}>
          <Input
            value={nameDraft}
            onChange={(event) => setNameDraft(event.target.value)}
            onBlur={(event) => {
              const next = event.target.value.trim() || 'xray0';
              setNameDraft(next);
              if (next !== settings.tunInterfaceName) {
                save({ tunInterfaceName: next });
              }
            }}
            onKeyDown={(event) => event.key === 'Enter' && event.currentTarget.blur()}
          />
        </Field>

        <Field
          label={tx('Выходной адаптер', 'Outbound adapter')}
          hint={failed ? tx('Не удалось получить список адаптеров.', 'Could not load the adapter list.') : undefined}
        >
          <Select
            value={settings.tunOutboundInterface ?? ''}
            onChange={(event) => save({ tunOutboundInterface: event.target.value || null })}
          >
            <option value="">{loading ? tx('Загрузка…', 'Loading…') : tx('Автоматически', 'Automatic')}</option>
            {settings.tunOutboundInterface && !known ? (
              <option value={settings.tunOutboundInterface}>{settings.tunOutboundInterface}</option>
            ) : null}
            {adapters.map((adapter) => (
              <option key={adapter.name} value={adapter.name}>
                {adapter.name} ({adapter.status})
              </option>
            ))}
          </Select>
        </Field>

        <ListGroup>
          <Row
            title={tx('Отключить IPv6', 'Disable IPv6')}
            subtitle={tx('Чтобы трафик не обходил VPN', 'So traffic cannot bypass the VPN')}
            trailing={
              <Switch
                checked={settings.tunDisableIpv6}
                label={tx('Отключить IPv6', 'Disable IPv6')}
                onChange={(tunDisableIpv6) => save({ tunDisableIpv6 })}
              />
            }
          />
        </ListGroup>
      </div>
    </Screen>
  );
}
