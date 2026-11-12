import { useTx } from '../lib/useTx';
import { applyPreset, visiblePresets } from '../lib/splitPresets';
import { useAppStore } from '../store/useAppStore';
import { Chip, ListGroup, Screen, Segmented, TagList } from '../ui';
import type { SplitTunnelMode } from '../types';

export function ExclusionsScreen() {
  const tx = useTx();
  const language = useAppStore((state) => state.settings.language);
  const settings = useAppStore((state) => state.settings);
  const saveSettings = useAppStore((state) => state.saveSettings);

  const mode = settings.splitTunnelMode;
  const tun = settings.connectionMode === 'tun';
  const proxyOnly = settings.connectionMode === 'proxyOnly';
  const save = (patch: Parameters<typeof saveSettings>[0]) => void saveSettings(patch, { silent: true });

  const hint: Record<SplitTunnelMode, string> = {
    disabled: tx('Весь трафик идёт через VPN.', 'All traffic goes through the VPN.'),
    bypassListed: tx(
      '«Кроме списка»: сайты и программы из списка идут напрямую, всё остальное — через VPN.',
      '"Except list": sites and apps from the list go direct, everything else through the VPN.',
    ),
    proxyListed: tx(
      '«Только список»: через VPN идут только сайты и программы из списка, остальное — напрямую.',
      '"Only list": only sites and apps from the list go through the VPN, the rest goes direct.',
    ),
  };

  const noSpaces = (value: string) =>
    /\s/.test(value) ? tx('Без пробелов', 'No spaces allowed') : null;

  return (
    <Screen title={tx('Исключения', 'Exclusions')} back="/settings">
      {proxyOnly ? (
        <div className="ui-note settings-gap">
          {tx(
            'В режиме «Прокси» исключения не применяются: система не меняется.',
            'Exclusions do not apply in "Proxy" mode: the system is left alone.',
          )}
        </div>
      ) : null}

      <Segmented<SplitTunnelMode>
        value={mode}
        options={[
          { value: 'disabled', label: tx('Выкл', 'Off') },
          { value: 'bypassListed', label: tx('Кроме списка', 'Except list') },
          { value: 'proxyListed', label: tx('Только список', 'Only list') },
        ]}
        onChange={(splitTunnelMode) => save({ splitTunnelMode })}
      />
      <p className="ui-hint">{hint[mode]}</p>

      {mode !== 'disabled' ? (
        <>
          <div className="ui-label">{tx('Быстро', 'Quick add')}</div>
          <div className="exclusions-presets">
            {visiblePresets(settings.connectionMode, mode).map((preset) => (
              <Chip
                key={preset.key}
                onClick={() =>
                  save(applyPreset({ domains: settings.splitTunnelDomains, ips: settings.splitTunnelIps }, preset))
                }
              >
                {preset.label[language]}
              </Chip>
            ))}
            <Chip tone="bad" onClick={() => save({ splitTunnelDomains: [], splitTunnelIps: [] })}>
              {tx('Очистить', 'Clear')}
            </Chip>
          </div>

          <ListGroup label={tx('Сайты', 'Sites')}>
            <TagList
              items={settings.splitTunnelDomains}
              addLabel={tx('Добавить', 'Add')}
              placeholder="example.com, full:login.example.com"
              validate={noSpaces}
              onChange={(splitTunnelDomains) => save({ splitTunnelDomains })}
            />
          </ListGroup>

          <ListGroup label="IP">
            <TagList
              items={settings.splitTunnelIps}
              addLabel={tx('Добавить', 'Add')}
              placeholder={tun ? '1.1.1.1, 8.8.8.0/24, geoip:ru' : '1.1.1.1, 192.168.0.0/16'}
              validate={noSpaces}
              onChange={(splitTunnelIps) => save({ splitTunnelIps })}
            />
          </ListGroup>
          <p className="ui-hint">
            {tun
              ? tx('IPv4, IPv6 и пресеты geoip:.', 'IPv4, IPv6 and geoip: presets.')
              : tx('Поддерживаются диапазоны IPv4.', 'IPv4 ranges are supported.')}
          </p>

          {tun ? (
            <>
              <ListGroup label={tx('Программы (только TUN)', 'Apps (TUN only)')}>
                <TagList
                  items={settings.splitTunnelProcesses}
                  addLabel={tx('Добавить', 'Add')}
                  placeholder="telegram.exe"
                  onChange={(splitTunnelProcesses) => save({ splitTunnelProcesses })}
                />
              </ListGroup>
              <p className="ui-hint">
                {tx(
                  'Имя программы (telegram.exe) или полный путь к .exe. В режиме «Только список» эти программы идут через VPN, остальные — напрямую.',
                  'Program name (telegram.exe) or a full path to the .exe. In "Only list" these programs use the VPN, the rest connect directly.',
                )}
              </p>
            </>
          ) : null}
        </>
      ) : null}
    </Screen>
  );
}
