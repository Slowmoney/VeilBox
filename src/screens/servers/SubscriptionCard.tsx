import { ChevronDown, MoreHorizontal, RefreshCw } from 'lucide-react';
import { useState } from 'react';
import { formatBytes } from '../../lib/format';
import { useTx } from '../../lib/useTx';
import { useAppStore } from '../../store/useAppStore';
import { Confirm, IconButton, Sheet, SheetAction } from '../../ui';
import type { AppLanguage, Subscription } from '../../types';

interface SubscriptionCardProps {
  subscription: Subscription;
  count: number;
  collapsed: boolean;
  onToggle: () => void;
}

function shortDate(value: string | null | undefined, language: AppLanguage, withTime = false) {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const locale = language === 'ru' ? 'ru-RU' : 'en-GB';
  return withTime
    ? date.toLocaleString(locale, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
    : date.toLocaleDateString(locale, { day: '2-digit', month: '2-digit', year: 'numeric' });
}

/** "5.7 из 1000 GB": the unit is not repeated when both numbers share it. */
function usageText(used: number, total: number | null, word: string) {
  const usedText = formatBytes(used);
  if (!total) {
    return usedText;
  }
  const totalText = formatBytes(total);
  const usedUnit = usedText.split(' ')[1];
  const totalUnit = totalText.split(' ')[1];
  return `${usedUnit === totalUnit ? usedText.split(' ')[0] : usedText} ${word} ${totalText}`;
}

/** Subscription header: name, refresh, menu; traffic with a usage bar, expiry, last refresh. */
export function SubscriptionCard({ subscription, count, collapsed, onToggle }: SubscriptionCardProps) {
  const tx = useTx();
  const language = useAppStore((state) => state.settings.language);
  const refreshSubscription = useAppStore((state) => state.refreshSubscription);
  const deleteSubscription = useAppStore((state) => state.deleteSubscription);
  const pushToast = useAppStore((state) => state.pushToast);
  const [busy, setBusy] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const used = (subscription.upload ?? 0) + (subscription.download ?? 0);
  const hasTraffic = subscription.upload != null || subscription.download != null;
  const total = subscription.total ?? null;
  const percent = total ? Math.min(100, Math.round((used / total) * 100)) : null;
  const expire = shortDate(subscription.expireAt, language);
  const expired = subscription.expireAt ? new Date(subscription.expireAt).getTime() <= Date.now() : false;
  const updated = shortDate(subscription.updatedAt, language, true);

  const refresh = async () => {
    setBusy(true);
    try {
      await refreshSubscription(subscription.id);
    } finally {
      setBusy(false);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(subscription.url);
      pushToast({ title: tx('Ссылка скопирована', 'Link copied'), message: '', tone: 'success' });
    } catch {
      pushToast({ title: tx('Не удалось скопировать', 'Copy failed'), message: '', tone: 'error' });
    }
  };

  return (
    <div className="sub-card">
      <div className="sub-card__head">
        <button type="button" className="sub-card__name" aria-expanded={!collapsed} onClick={onToggle}>
          <ChevronDown size={16} className={collapsed ? 'sub-card__chev is-collapsed' : 'sub-card__chev'} />
          <strong>{subscription.name}</strong>
        </button>
        <IconButton aria-label={tx('Обновить', 'Refresh')} disabled={busy} onClick={() => void refresh()}>
          <RefreshCw size={16} className={busy ? 'ui-spin' : undefined} />
        </IconButton>
        <IconButton aria-label={tx('Ещё', 'More')} onClick={() => setMenuOpen(true)}>
          <MoreHorizontal size={18} />
        </IconButton>
      </div>

      {percent != null ? (
        <div className="sub-card__bar" role="progressbar" aria-valuenow={percent} aria-valuemin={0} aria-valuemax={100}>
          <span style={{ width: `${Math.max(percent, 2)}%` }} className={percent >= 90 ? 'is-bad' : undefined} />
        </div>
      ) : null}

      <div className="sub-card__meta">
        <span>
          {hasTraffic
            ? usageText(used, total, tx('из', 'of'))
            : `${count} ${tx('серверов', 'servers')}`}
        </span>
        {expire ? (
          <span className={expired ? 'tone-bad' : undefined}>
            {expired ? tx('истекла', 'expired') : tx('до', 'until')} {expire}
          </span>
        ) : null}
      </div>
      {updated ? (
        <div className="sub-card__meta sub-card__meta--faint">
          <span>
            {tx('Обновлено', 'Updated')} {updated}
          </span>
        </div>
      ) : null}

      <Sheet open={menuOpen} onClose={() => setMenuOpen(false)} title={subscription.name}>
        <SheetAction
          onClick={() => {
            setMenuOpen(false);
            void refresh();
          }}
        >
          {tx('Обновить', 'Refresh')}
        </SheetAction>
        <SheetAction
          onClick={() => {
            setMenuOpen(false);
            void copyLink();
          }}
        >
          {tx('Скопировать ссылку', 'Copy link')}
        </SheetAction>
        <SheetAction
          danger
          onClick={() => {
            setMenuOpen(false);
            setConfirmOpen(true);
          }}
        >
          {tx('Удалить', 'Delete')}
        </SheetAction>
      </Sheet>

      <Confirm
        open={confirmOpen}
        title={tx(`Удалить подписку «${subscription.name}»?`, `Delete subscription "${subscription.name}"?`)}
        message={tx('Её серверы тоже будут удалены.', 'Its servers will be removed too.')}
        confirmLabel={tx('Удалить', 'Delete')}
        onClose={() => setConfirmOpen(false)}
        onConfirm={() => void deleteSubscription(subscription.id)}
      />
    </div>
  );
}
