import { ArrowUpDown, Plus, RefreshCw, Search, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { pickerGroups } from '../lib/profileGroups';
import { useSortMode } from '../lib/sortMode';
import { useTx } from '../lib/useTx';
import { useAppStore } from '../store/useAppStore';
import { Button, Input, ListGroup, Screen } from '../ui';
import { AddSheet } from './servers/AddSheet';
import { ProfileRow } from './servers/ProfileRow';
import { ProfileSheet } from './servers/ProfileSheet';
import { SubscriptionCard } from './servers/SubscriptionCard';
import type { Profile } from '../types';

export function ServersScreen() {
  const tx = useTx();
  const navigate = useNavigate();
  const location = useLocation();
  const profiles = useAppStore((state) => state.profiles);
  const subscriptions = useAppStore((state) => state.subscriptions);
  const latencies = useAppStore((state) => state.latencies);
  const profileCountries = useAppStore((state) => state.profileCountries);
  const selectedProfileId = useAppStore((state) => state.selectedProfileId);
  const refreshLatencies = useAppStore((state) => state.refreshLatencies);

  const [sortMode, cycleSort] = useSortMode();
  const [search, setSearch] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [pinging, setPinging] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [sheetProfileId, setSheetProfileId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // "Добавить сервер" on an empty Главная lands here with the add sheet open.
  useEffect(() => {
    if ((location.state as { add?: boolean } | null)?.add) {
      setAddOpen(true);
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [location.pathname, location.state, navigate]);

  const query = search.trim().toLowerCase();
  const matches = useMemo(
    () =>
      query
        ? (profile: Profile) => {
            const country = profileCountries[profile.id];
            return [profile.name, country?.countryName ?? '', country?.countryCode ?? '']
              .join(' ')
              .toLowerCase()
              .includes(query);
          }
        : undefined,
    [query, profileCountries],
  );

  const manualLabel = tx('Свои профили', 'Own profiles');
  const groups = useMemo(
    () => pickerGroups(profiles, subscriptions, sortMode, latencies, { manualLabel, filter: matches, keepEmpty: true }),
    [profiles, subscriptions, sortMode, latencies, manualLabel, matches],
  );

  const pingAll = async () => {
    setPinging(true);
    try {
      await refreshLatencies();
    } finally {
      setPinging(false);
    }
  };

  const sortLabel =
    sortMode === 'ping' ? tx('По пингу', 'By ping') : sortMode === 'name' ? tx('По имени', 'By name') : tx('Сортировка', 'Sort');
  const sheetProfile = profiles.find((profile) => profile.id === sheetProfileId) ?? null;
  const nothing = profiles.length === 0 && subscriptions.length === 0;

  return (
    <Screen
      title={tx('Серверы', 'Servers')}
      actions={
        <Button size="sm" variant="ghost" onClick={() => setAddOpen(true)}>
          <Plus size={16} />
          {tx('Добавить', 'Add')}
        </Button>
      }
    >
      <div className="srv-tools">
        <button type="button" disabled={pinging || profiles.length === 0} onClick={() => void pingAll()}>
          <RefreshCw size={14} className={pinging ? 'ui-spin' : undefined} />
          <span>{tx('Пинг', 'Ping')}</span>
        </button>
        <button type="button" className={sortMode !== 'none' ? 'is-on' : undefined} onClick={cycleSort}>
          <ArrowUpDown size={14} />
          <span>{sortLabel}</span>
        </button>
        <button
          type="button"
          className={searchOpen || query ? 'is-on' : undefined}
          onClick={() => {
            if (searchOpen) {
              setSearch('');
            }
            setSearchOpen(!searchOpen);
          }}
        >
          <Search size={14} />
          <span>{tx('Поиск', 'Search')}</span>
        </button>
      </div>

      {searchOpen ? (
        <div className="srv-search">
          <Input
            autoFocus
            value={search}
            placeholder={tx('Название или страна', 'Name or country')}
            onChange={(event) => setSearch(event.target.value)}
          />
          {search ? (
            <button type="button" className="ui-iconbtn" aria-label={tx('Очистить', 'Clear')} onClick={() => setSearch('')}>
              <X size={16} />
            </button>
          ) : null}
        </div>
      ) : null}

      {nothing ? (
        <div className="ui-empty">
          <p>{tx('Серверов пока нет', 'No servers yet')}</p>
          <Button onClick={() => setAddOpen(true)}>{tx('Добавить сервер', 'Add a server')}</Button>
        </div>
      ) : groups.length === 0 ? (
        <div className="ui-empty">
          <p>{tx('Ничего не найдено', 'Nothing found')}</p>
        </div>
      ) : (
        groups.map((group) => (
          <div key={group.key} className="srv-group">
            {group.subscription ? (
              <SubscriptionCard
                subscription={group.subscription}
                count={group.profiles.length}
                collapsed={!!collapsed[group.key]}
                onToggle={() => setCollapsed((current) => ({ ...current, [group.key]: !current[group.key] }))}
              />
            ) : null}
            {!collapsed[group.key] && group.profiles.length > 0 ? (
              <ListGroup cards label={group.subscription ? undefined : (group.label ?? undefined)}>
                {group.profiles.map((profile) => (
                  <ProfileRow
                    key={profile.id}
                    profile={profile}
                    selected={profile.id === selectedProfileId}
                    onOpen={() => setSheetProfileId(profile.id)}
                  />
                ))}
              </ListGroup>
            ) : null}
          </div>
        ))
      )}

      <AddSheet open={addOpen} onClose={() => setAddOpen(false)} />
      <ProfileSheet profile={sheetProfile} onClose={() => setSheetProfileId(null)} />
    </Screen>
  );
}
