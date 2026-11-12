import { Check } from 'lucide-react';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTx } from '../lib/useTx';
import { useAppStore } from '../store/useAppStore';
import { ListGroup, Row, Screen, Segmented, Sheet, SheetAction, Switch } from '../ui';
import type { AppLanguage, ConnectionMode, SplitTunnelMode, ThemeMode } from '../types';

export function SettingsScreen() {
  const tx = useTx();
  const navigate = useNavigate();
  const settings = useAppStore((state) => state.settings);
  const saveSettings = useAppStore((state) => state.saveSettings);
  const connectionState = useAppStore((state) => state.connectionStatus.state);
  const about = useAppStore((state) => state.about);
  const update = useAppStore((state) => state.update);
  const [sheet, setSheet] = useState<'theme' | 'language' | null>(null);

  const save = (patch: Parameters<typeof saveSettings>[0]) => void saveSettings(patch, { silent: true });
  const active = connectionState === 'connected' || connectionState === 'connecting';

  const modeHint: Record<ConnectionMode, string> = {
    systemProxy: tx(
      'Весь трафик программ, которые используют системный прокси. Браузеры, Telegram.',
      'Traffic of apps that use the system proxy: browsers, Telegram.',
    ),
    tun: tx('Весь трафик компьютера идёт через VPN.', 'All traffic of the computer goes through the VPN.'),
    proxyOnly: tx(
      'Система не меняется. Прокси нужно указать в программе самому.',
      'The system is left alone. Set the proxy in the app yourself.',
    ),
  };

  const splitLabel: Record<SplitTunnelMode, string> = {
    disabled: tx('Выкл', 'Off'),
    bypassListed: tx('Кроме списка', 'Except list'),
    proxyListed: tx('Только список', 'Only list'),
  };

  const themeLabel: Record<ThemeMode, string> = {
    system: tx('Системная', 'System'),
    dark: tx('Тёмная', 'Dark'),
    light: tx('Светлая', 'Light'),
  };

  const languageLabel: Record<AppLanguage, string> = { ru: 'Русский', en: 'English' };

  return (
    <Screen title={tx('Настройки', 'Settings')}>
      <div className="ui-label">{tx('Режим', 'Mode')}</div>
      <Segmented<ConnectionMode>
        value={settings.connectionMode}
        disabled={active}
        options={[
          { value: 'systemProxy', label: tx('Система', 'System') },
          { value: 'tun', label: 'TUN' },
          { value: 'proxyOnly', label: tx('Прокси', 'Proxy') },
        ]}
        onChange={(connectionMode) => save({ connectionMode })}
      />
      <p className="ui-hint">
        {active ? tx('Чтобы сменить режим, сначала отключитесь.', 'Disconnect to change the mode.') : modeHint[settings.connectionMode]}
      </p>
      {settings.connectionMode === 'tun' ? (
        <div className="settings-gap">
          <ListGroup>
            <Row title={tx('Дополнительно', 'Advanced')} chevron onClick={() => navigate('/settings/tun')} />
          </ListGroup>
        </div>
      ) : null}

      <ListGroup label={tx('Подключение', 'Connection')}>
        <Row
          title={tx('Исключения', 'Exclusions')}
          value={splitLabel[settings.splitTunnelMode]}
          chevron
          onClick={() => navigate('/settings/exclusions')}
        />
        <Row
          title={tx('Балансировка', 'Balancing')}
          subtitle={tx('Сам выбирает быстрый сервер', 'Picks the fastest server')}
          trailing={
            <Switch
              checked={settings.balanceServers}
              disabled={active}
              label={tx('Балансировка', 'Balancing')}
              onChange={(balanceServers) => save({ balanceServers })}
            />
          }
        />
        <Row
          title={tx('Переподключаться', 'Reconnect')}
          trailing={
            <Switch
              checked={settings.autoReconnect}
              label={tx('Переподключаться', 'Reconnect')}
              onChange={(autoReconnect) => save({ autoReconnect })}
            />
          }
        />
      </ListGroup>

      <ListGroup label={tx('Приложение', 'App')}>
        <Row title={tx('Тема', 'Theme')} value={themeLabel[settings.theme]} chevron onClick={() => setSheet('theme')} />
        <Row title={tx('Язык', 'Language')} value={languageLabel[settings.language]} chevron onClick={() => setSheet('language')} />
        <Row
          title={tx('Запускать с системой', 'Launch at startup')}
          trailing={
            <Switch
              checked={settings.launchAtStartup}
              label={tx('Запускать с системой', 'Launch at startup')}
              onChange={(launchAtStartup) => save({ launchAtStartup })}
            />
          }
        />
        <Row
          title={tx('Сворачивать в трей', 'Minimize to tray')}
          trailing={
            <Switch
              checked={settings.minimizeToTray}
              label={tx('Сворачивать в трей', 'Minimize to tray')}
              onChange={(minimizeToTray) => save({ minimizeToTray })}
            />
          }
        />
      </ListGroup>

      <ListGroup label={tx('Помощь', 'Help')}>
        <Row
          title={tx('Журнал', 'Journal')}
          value={tx('для поддержки', 'for support')}
          chevron
          onClick={() => navigate('/settings/journal')}
        />
        <Row
          title={tx('О программе', 'About')}
          value={
            [about?.appVersion, update ? tx('есть обновление', 'update available') : null].filter(Boolean).join(' · ') || undefined
          }
          chevron
          onClick={() => navigate('/settings/about')}
        />
      </ListGroup>

      <Sheet open={sheet === 'theme'} onClose={() => setSheet(null)} title={tx('Тема', 'Theme')}>
        {(['system', 'dark', 'light'] as ThemeMode[]).map((theme) => (
          <SheetAction
            key={theme}
            onClick={() => {
              save({ theme });
              setSheet(null);
            }}
          >
            {themeLabel[theme]}
            {settings.theme === theme ? <Check size={16} className="ui-act__check" /> : null}
          </SheetAction>
        ))}
      </Sheet>

      <Sheet open={sheet === 'language'} onClose={() => setSheet(null)} title={tx('Язык', 'Language')}>
        {(['ru', 'en'] as AppLanguage[]).map((language) => (
          <SheetAction
            key={language}
            onClick={() => {
              save({ language });
              setSheet(null);
            }}
          >
            {languageLabel[language]}
            {settings.language === language ? <Check size={16} className="ui-act__check" /> : null}
          </SheetAction>
        ))}
      </Sheet>
    </Screen>
  );
}
