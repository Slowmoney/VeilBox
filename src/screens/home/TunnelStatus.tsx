import { useEffect, useRef, useState } from 'react';
import { formatBytes } from '../../lib/format';
import { formatAgo, formatRate, type HandshakeHealth } from '../../lib/handshake';
import { useTx } from '../../lib/useTx';
import { useAppStore } from '../../store/useAppStore';
import { ListGroup, Row } from '../../ui';
import type { AppLanguage } from '../../types';

interface TunnelStatusProps {
  health: HandshakeHealth;
  now: number;
  language: AppLanguage;
}

interface Rate {
  rx: number;
  tx: number;
}

/** Live AmneziaWG facts: handshake, traffic since connect and its current rate, endpoint. */
export function TunnelStatus({ health, now, language }: TunnelStatusProps) {
  const tx = useTx();
  const status = useAppStore((state) => state.awgStatus);
  const previous = useRef<{ rx: number; tx: number; at: number } | null>(null);
  const [rate, setRate] = useState<Rate | null>(null);

  useEffect(() => {
    if (!status) {
      previous.current = null;
      setRate(null);
      return;
    }
    const at = Date.now();
    const before = previous.current;
    if (before && at > before.at) {
      const seconds = (at - before.at) / 1000;
      setRate({
        rx: Math.max(0, (status.rxBytes - before.rx) / seconds),
        tx: Math.max(0, (status.txBytes - before.tx) / seconds),
      });
    }
    previous.current = { rx: status.rxBytes, tx: status.txBytes, at };
  }, [status]);

  const handshakeText =
    health === 'pending'
      ? tx('ожидание…', 'waiting…')
      : health === 'none'
        ? tx('Нет рукопожатия', 'No handshake')
        : formatAgo(now / 1000 - (status?.latestHandshakeAt ?? 0), language);
  const handshakeClass =
    health === 'healthy' ? 'tone-ok' : health === 'stale' ? 'tone-warn' : health === 'none' ? 'tone-bad' : '';

  return (
    <ListGroup label={tx('Туннель', 'Tunnel')}>
      <Row
        title={tx('Рукопожатие', 'Handshake')}
        value={<span className={handshakeClass}>{handshakeText}</span>}
      />
      {status ? (
        <>
          <Row
            title={tx('Трафик', 'Traffic')}
            value={`↓ ${formatBytes(status.rxBytes)}  ↑ ${formatBytes(status.txBytes)}`}
          />
          {rate ? (
            <Row title={tx('Скорость', 'Speed')} value={`↓ ${formatRate(rate.rx)}  ↑ ${formatRate(rate.tx)}`} />
          ) : null}
          {status.endpoint ? <Row title={tx('Сервер', 'Server')} value={status.endpoint} /> : null}
        </>
      ) : null}
    </ListGroup>
  );
}
