import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { detectImportKind } from './lib/importDetect';
import { applyTheme } from './lib/theme';
import { AboutScreen } from './screens/AboutScreen';
import { ExclusionsScreen } from './screens/ExclusionsScreen';
import { HomeScreen } from './screens/HomeScreen';
import { JournalScreen } from './screens/JournalScreen';
import { LegalScreen } from './screens/LegalScreen';
import { ProfileEditScreen } from './screens/ProfileEditScreen';
import { ServersScreen } from './screens/ServersScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { TunScreen } from './screens/TunScreen';
import { useAppStore } from './store/useAppStore';
import { AppShell } from './ui/AppShell';

function AppContent() {
  const location = useLocation();
  const initialize = useAppStore((state) => state.initialize);
  const refreshConnectionStatus = useAppStore((state) => state.refreshConnectionStatus);
  const refreshLogs = useAppStore((state) => state.refreshLogs);
  const refreshLatencies = useAppStore((state) => state.refreshLatencies);
  const theme = useAppStore((state) => state.settings.theme);
  const initialized = useAppStore((state) => state.initialized);
  const importProfile = useAppStore((state) => state.importProfile);
  const importProfilesJson = useAppStore((state) => state.importProfilesJson);
  const importAmneziaConfig = useAppStore((state) => state.importAmneziaConfig);
  const importAmneziaUri = useAppStore((state) => state.importAmneziaUri);
  const importSubscription = useAppStore((state) => state.importSubscription);

  useEffect(() => {
    void initialize();
  }, [initialize]);

  useEffect(() => {
    applyTheme(theme);
    if (theme !== 'system') {
      return;
    }
    const media = window.matchMedia('(prefers-color-scheme: light)');
    const onChange = () => applyTheme('system');
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, [theme]);

  const journalOpen = location.pathname === '/settings/journal';

  useEffect(() => {
    if (!initialized) {
      return;
    }

    const statusTimer = window.setInterval(() => {
      void refreshConnectionStatus();
      if (journalOpen) {
        void refreshLogs('full');
      }
    }, 3000);

    const latencyTimer = window.setInterval(() => {
      void refreshLatencies();
    }, 15000);

    // New version from GitHub Releases: once at start, then every 6 hours.
    void useAppStore.getState().checkForUpdate(true);
    const updateTimer = window.setInterval(() => {
      void useAppStore.getState().checkForUpdate(true);
    }, 6 * 60 * 60 * 1000);

    // Subscriptions with a `profile-update-interval` header refresh themselves.
    void useAppStore.getState().autoRefreshDueSubscriptions();
    const subscriptionTimer = window.setInterval(() => {
      void useAppStore.getState().autoRefreshDueSubscriptions();
    }, 10 * 60 * 1000);

    return () => {
      window.clearInterval(statusTimer);
      window.clearInterval(latencyTimer);
      window.clearInterval(subscriptionTimer);
      window.clearInterval(updateTimer);
    };
  }, [initialized, journalOpen, refreshConnectionStatus, refreshLatencies, refreshLogs]);

  // Ctrl+V anywhere outside a text field imports whatever was copied.
  useEffect(() => {
    const onPaste = (event: ClipboardEvent) => {
      const active = document.activeElement as HTMLElement | null;
      if (active?.tagName === 'INPUT' || active?.tagName === 'TEXTAREA' || active?.isContentEditable) {
        return;
      }

      const text = event.clipboardData?.getData('text')?.trim();
      if (!text || text.length > 1024 * 1024) {
        return;
      }

      const kind = detectImportKind(text);
      if (kind === 'unknown') {
        return;
      }
      event.preventDefault();
      switch (kind) {
        case 'proxyUri':
          void importProfile(text);
          break;
        case 'subscription':
          void importSubscription(text);
          break;
        case 'amneziaUri':
          void importAmneziaUri(text);
          break;
        case 'amneziaConfig':
          void importAmneziaConfig(text);
          break;
        case 'json':
          void importProfilesJson(text);
          break;
      }
    };

    window.addEventListener('paste', onPaste);
    return () => window.removeEventListener('paste', onPaste);
  }, [importAmneziaConfig, importAmneziaUri, importProfile, importProfilesJson, importSubscription]);

  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/servers" element={<ServersScreen />} />
        <Route path="/servers/profile/:id" element={<ProfileEditScreen />} />
        <Route path="/settings" element={<SettingsScreen />} />
        <Route path="/settings/exclusions" element={<ExclusionsScreen />} />
        <Route path="/settings/tun" element={<TunScreen />} />
        <Route path="/settings/journal" element={<JournalScreen />} />
        <Route path="/settings/about" element={<AboutScreen />} />
        <Route path="/settings/about/:doc" element={<LegalScreen />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </AppShell>
  );
}

export default function App() {
  return <AppContent />;
}
