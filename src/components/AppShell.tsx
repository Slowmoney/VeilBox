import { Gauge, Info, Logs, Settings } from 'lucide-react';
import { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { t } from '../lib/i18n';
import { useAppStore } from '../store/useAppStore';

interface AppShellProps {
  children: ReactNode;
}

/**
 * Phone-style shell: compact top bar, scrollable content and a bottom tab bar
 * (the window is portrait, see tauri.conf.json).
 */
export function AppShell({ children }: AppShellProps) {
  const settings = useAppStore((state) => state.settings);
  const saveSettings = useAppStore((state) => state.saveSettings);
  const connectionState = useAppStore((state) => state.connectionStatus.state);
  const update = useAppStore((state) => state.update);
  const updateState = useAppStore((state) => state.updateState);
  const installUpdate = useAppStore((state) => state.installUpdate);

  const items = [
    { to: '/', label: t(settings.language, 'navDashboard'), icon: Gauge },
    { to: '/settings', label: t(settings.language, 'navSettings'), icon: Settings },
    { to: '/logs', label: t(settings.language, 'navLogs'), icon: Logs },
    { to: '/about', label: t(settings.language, 'navAbout'), icon: Info },
  ];

  return (
    <div className="app-shell app-shell-mobile">
      <header className="mobile-topbar">
        <div className="mobile-brand">
          <img src="/app-icon.png" alt="" className="mobile-brand-icon" />
          <span>VeilBox</span>
          <span className={`mobile-status-dot is-${connectionState}`} aria-hidden="true" />
        </div>
        <button
          type="button"
          className="mobile-lang-button"
          title={t(settings.language, 'langButton')}
          onClick={() => void saveSettings({ language: settings.language === 'ru' ? 'en' : 'ru' })}
        >
          {settings.language.toUpperCase()}
        </button>
      </header>

      {update ? (
        <div className="update-banner">
          <span>
            {settings.language === 'ru' ? 'Доступна версия' : 'Version'} {update.version}
            {settings.language === 'ru' ? '' : ' is available'}
          </span>
          <button type="button" disabled={updateState === 'installing'} onClick={() => void installUpdate()}>
            {updateState === 'installing'
              ? settings.language === 'ru' ? 'Обновляю…' : 'Updating…'
              : settings.language === 'ru' ? 'Обновить' : 'Update'}
          </button>
        </div>
      ) : null}

      <main className="shell-main">{children}</main>

      <nav className="bottom-nav">
        {items.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            end={to === '/'}
            className={({ isActive }) => `bottom-nav-link${isActive ? ' is-active' : ''}`}
          >
            <Icon size={20} />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
