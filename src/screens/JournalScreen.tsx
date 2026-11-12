import { Check, ClipboardCopy, Trash2, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { toRussianLog } from '../lib/logText';
import { useTx } from '../lib/useTx';
import { useAppStore } from '../store/useAppStore';
import { Button, IconButton, ListGroup, Row, Screen, Switch } from '../ui';
import type { LogEntry } from '../types';

function clock(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function dayKey(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : date.toDateString();
}

/** Raw Xray stdout/stderr is for the support copy only, not for the list. */
const isRaw = (entry: LogEntry) => entry.source === 'xray-stdout' || entry.source === 'xray-stderr';

/**
 * Journal for people: what happened with the connection, newest first, and one
 * button that copies everything support needs.
 */
export function JournalScreen() {
  const tx = useTx();
  const logs = useAppStore((state) => state.logs);
  const about = useAppStore((state) => state.about);
  const status = useAppStore((state) => state.connectionStatus);
  const settings = useAppStore((state) => state.settings);
  const clearLogs = useAppStore((state) => state.clearLogs);
  const saveSettings = useAppStore((state) => state.saveSettings);
  const refreshLogs = useAppStore((state) => state.refreshLogs);
  const pushToast = useAppStore((state) => state.pushToast);
  const [problemsOnly, setProblemsOnly] = useState(false);
  const language = settings.language;

  useEffect(() => {
    void refreshLogs('full');
  }, [refreshLogs]);

  const all = useMemo(() => [...logs.connection, ...logs.app], [logs]);
  const visible = useMemo(
    () =>
      all
        .filter((entry) => !isRaw(entry))
        .filter((entry) => !problemsOnly || entry.level === 'error' || entry.level === 'warn')
        .sort((a, b) => (a.timestamp < b.timestamp ? 1 : -1))
        .slice(0, 300),
    [all, problemsOnly],
  );
  const errorCount = useMemo(() => all.filter((entry) => !isRaw(entry) && entry.level === 'error').length, [all]);

  const copyForSupport = async () => {
    const header = [
      `VeilBox ${about?.appVersion ?? '?'} (${about?.platform ?? '?'}), Xray ${about?.xrayVersion ?? '?'}`,
      `Mode: ${settings.connectionMode}, status: ${status.state}${status.message ? ` — ${status.message}` : ''}`,
      `Copied: ${new Date().toISOString()}`,
      '',
    ];
    const lines = [...all]
      .sort((a, b) => (a.timestamp < b.timestamp ? -1 : 1))
      .map((entry) => `[${entry.timestamp}] ${entry.level.toUpperCase()} ${entry.source}: ${entry.message}`);
    try {
      await navigator.clipboard.writeText([...header, ...lines].join('\n'));
      pushToast({
        title: tx('Скопировано', 'Copied'),
        message: tx('Отправьте это в поддержку.', 'Send it to support.'),
        tone: 'success',
      });
    } catch {
      pushToast({ title: tx('Не удалось скопировать', 'Copy failed'), message: '', tone: 'error' });
    }
  };

  const today = new Date().toDateString();
  const yesterday = new Date(Date.now() - 86_400_000).toDateString();
  const dayLabel = (key: string, timestamp: string) =>
    key === today
      ? tx('Сегодня', 'Today')
      : key === yesterday
        ? tx('Вчера', 'Yesterday')
        : new Date(timestamp).toLocaleDateString(language === 'ru' ? 'ru-RU' : 'en-GB');

  return (
    <Screen
      title={tx('Журнал', 'Journal')}
      back="/settings"
      actions={
        <IconButton aria-label={tx('Очистить журнал', 'Clear journal')} onClick={() => void clearLogs()}>
          <Trash2 size={17} />
        </IconButton>
      }
    >
      <div className="jr-top">
        {errorCount > 0 ? (
          <span className="jr-pill jr-pill--bad">
            <TriangleAlert size={14} /> {tx('Ошибок', 'Errors')}: {errorCount}
          </span>
        ) : (
          <span className="jr-pill jr-pill--ok">
            <Check size={14} /> {tx('Ошибок нет', 'No errors')}
          </span>
        )}
      </div>

      <Button block onClick={() => void copyForSupport()}>
        <ClipboardCopy size={16} />
        {tx('Скопировать для поддержки', 'Copy for support')}
      </Button>

      <ListGroup>
        <Row
          title={tx('Только проблемы', 'Problems only')}
          trailing={<Switch checked={problemsOnly} label={tx('Только проблемы', 'Problems only')} onChange={setProblemsOnly} />}
        />
      </ListGroup>

      {visible.length === 0 ? (
        <div className="ui-empty">
          {problemsOnly
            ? tx('Проблем не было.', 'No problems.')
            : tx('Пока пусто. События появятся после подключения.', 'Empty for now. Events appear after you connect.')}
        </div>
      ) : (
        <ol className="jr-list">
          {visible.map((entry, index) => {
            const key = dayKey(entry.timestamp);
            const newDay = index === 0 || key !== dayKey(visible[index - 1].timestamp);
            return (
              <li key={`${entry.source}-${entry.id}`}>
                {newDay ? <div className="ui-label">{dayLabel(key, entry.timestamp)}</div> : null}
                <div className={`jr-item jr-item--${entry.level}`}>
                  <time>{clock(entry.timestamp)}</time>
                  <span>{language === 'ru' ? toRussianLog(entry.message) : entry.message}</span>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <ListGroup label={tx('Для поддержки', 'For support')}>
        <Row
          title={tx('Подробный журнал', 'Detailed log')}
          subtitle={tx('Включайте, только если просит поддержка', 'Turn on only if support asks')}
          trailing={
            <Switch
              checked={settings.debugLogging}
              label={tx('Подробный журнал', 'Detailed log')}
              onChange={(debugLogging) => void saveSettings({ debugLogging }, { silent: true })}
            />
          }
        />
      </ListGroup>
    </Screen>
  );
}
