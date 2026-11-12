import { List, Power, Settings } from 'lucide-react';
import type { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { tx } from '../lib/text';
import { useAppStore } from '../store/useAppStore';
import { TabBar } from './TabBar';
import { Toasts } from './Toasts';

/** Window shell: screen area, bottom tabs, toasts. The update banner lives on Главная. */
export function AppShell({ children }: { children: ReactNode }) {
  const language = useAppStore((state) => state.settings.language);
  const update = useAppStore((state) => state.update);
  const updateState = useAppStore((state) => state.updateState);
  const installUpdate = useAppStore((state) => state.installUpdate);
  const { pathname } = useLocation();

  const items = [
    { to: '/', label: tx(language, 'Главная', 'Home'), icon: Power },
    { to: '/servers', label: tx(language, 'Серверы', 'Servers'), icon: List },
    { to: '/settings', label: tx(language, 'Настройки', 'Settings'), icon: Settings },
  ];

  return (
    <div className="ui-shell">
      {update && pathname === '/' ? (
        <div className="ui-banner">
          <span>
            {tx(language, `Доступна версия ${update.version}`, `Version ${update.version} available`)}
          </span>
          <button type="button" disabled={updateState === 'installing'} onClick={() => void installUpdate()}>
            {updateState === 'installing' ? tx(language, 'Обновляю…', 'Updating…') : tx(language, 'Обновить', 'Update')}
          </button>
        </div>
      ) : null}
      <main className="ui-main">{children}</main>
      <TabBar items={items} />
      <Toasts />
    </div>
  );
}
