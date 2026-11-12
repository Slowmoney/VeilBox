import { useMemo } from 'react';
import { handshakeHealth } from '../lib/handshake';
import { pingView, protocolLine } from '../lib/profileText';
import { useNow } from '../lib/useNow';
import { useTx } from '../lib/useTx';
import { useAppStore } from '../store/useAppStore';
import type { Profile } from '../types';
import { Chip, Screen } from '../ui';
import { PowerButton } from './home/PowerButton';
import { ServerPicker } from './home/ServerPicker';
import { TunnelStatus } from './home/TunnelStatus';
import { useStage } from './home/useStage';
import { useProfileName } from './shared/ProfileMeta';

function formatDuration(totalSeconds: number) {
  const seconds = Math.max(0, totalSeconds);
  const parts = [Math.floor(seconds / 3600), Math.floor((seconds % 3600) / 60), seconds % 60];
  return parts.map((part) => String(part).padStart(2, '0')).join(':');
}

/** Selected server as chips: short name, protocol, ping; proxy addresses in proxy-only mode. */
function ServerChips({ profile }: { profile: Profile }) {
  const tx = useTx();
  const language = useAppStore((state) => state.settings.language);
  const status = useAppStore((state) => state.connectionStatus);
  const connectionMode = useAppStore((state) => state.settings.connectionMode);
  const latency = useAppStore((state) => state.latencies[profile.id]);
  const country = useAppStore((state) => state.profileCountries[profile.id]);
  const pushToast = useAppStore((state) => state.pushToast);
  const name = useProfileName(profile);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      pushToast({ title: tx('Скопировано', 'Copied'), message: text, tone: 'success' });
    } catch {
      pushToast({ title: tx('Не удалось скопировать', 'Copy failed'), message: '', tone: 'error' });
    }
  };

  const short = country?.countryCode?.toUpperCase() ?? name;
  const ping = pingView(latency, language);
  const proxyAddresses =
    connectionMode === 'proxyOnly' && profile.engine !== 'amneziawg' && status.localHttpProxyPort
      ? [
          `HTTP 127.0.0.1:${status.localHttpProxyPort}`,
          ...(status.localSocksProxyPort ? [`SOCKS 127.0.0.1:${status.localSocksProxyPort}`] : []),
        ]
      : [];

  return (
    <div className="home-chips">
      <Chip>
        {short} · {protocolLine(profile).split(' · ')[0]}
      </Chip>
      {latency ? <Chip tone={ping.tone === 'none' ? 'default' : ping.tone}>{ping.text}</Chip> : null}
      {proxyAddresses.map((address) => (
        <Chip key={address} onClick={() => void copy(address.split(' ')[1])} title={tx('Скопировать', 'Copy')}>
          {address}
        </Chip>
      ))}
    </div>
  );
}

export function HomeScreen() {
  const tx = useTx();
  const language = useAppStore((state) => state.settings.language);
  const status = useAppStore((state) => state.connectionStatus);
  const profiles = useAppStore((state) => state.profiles);
  const subscriptions = useAppStore((state) => state.subscriptions);
  const selectedProfileId = useAppStore((state) => state.selectedProfileId);
  const awgStatus = useAppStore((state) => state.awgStatus);
  const connect = useAppStore((state) => state.connect);
  const disconnect = useAppStore((state) => state.disconnect);

  const selected = profiles.find((profile) => profile.id === selectedProfileId) ?? null;
  const subscriptionName = selected?.subscriptionId
    ? subscriptions.find((subscription) => subscription.id === selected.subscriptionId)?.name
    : undefined;

  const stage = useStage(status.state);
  const connected = status.state === 'connected';
  const connectedAt = status.connectedAt ? new Date(status.connectedAt).getTime() : null;
  const now = useNow(connected);

  const activeProfile = profiles.find((profile) => profile.id === status.activeProfileId) ?? null;
  const awgSession = connected && activeProfile?.engine === 'amneziawg';
  const health = useMemo(
    () =>
      awgSession && connectedAt != null
        ? handshakeHealth(awgStatus?.latestHandshakeAt ?? null, connectedAt, now)
        : null,
    [awgSession, connectedAt, awgStatus, now],
  );
  const noLink = stage === 'connected' && health === 'none';

  const stateText =
    stage === 'connecting'
      ? tx('Подключение…', 'Connecting…')
      : stage === 'failed'
        ? tx('Ошибка', 'Error')
        : noLink
          ? tx('Нет связи с сервером', 'Server unreachable')
          : stage === 'connected'
            ? tx('Подключено', 'Connected')
            : tx('Отключено', 'Disconnected');
  const stateTone = stage === 'connecting' || noLink ? 'warn' : stage === 'failed' ? 'bad' : stage === 'connected' ? 'ok' : '';

  const seconds = connected && connectedAt != null ? Math.floor((now - connectedAt) / 1000) : 0;

  const onPower = () => {
    if (connected) {
      void disconnect();
    } else if (selected) {
      void connect(selected.id);
    }
  };

  return (
    <Screen title="VeilBox" subtitle={subscriptionName}>
      <div className="home-stage">
        <PowerButton
          stage={stage}
          label={stateText}
          disabled={stage === 'connecting' || (!connected && !selected)}
          onClick={onPower}
        />
        <div className={`home-state${stateTone ? ` tone-${stateTone}` : ''}`}>{stateText}</div>
        <div className="home-timer">{connected ? formatDuration(seconds) : ' '}</div>
        {selected ? <ServerChips profile={selected} /> : null}
      </div>

      {awgSession && health ? <TunnelStatus health={health} now={now} language={language} /> : null}

      <ServerPicker />
    </Screen>
  );
}
