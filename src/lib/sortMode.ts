import { useState } from 'react';
import type { SortMode } from './profileGroups';

export const SORT_MODES: SortMode[] = ['none', 'ping', 'name'];
const SORT_STORAGE_KEY = 'veilbox.profileSort';

export function loadSortMode(): SortMode {
  try {
    const value = window.localStorage.getItem(SORT_STORAGE_KEY);
    return SORT_MODES.includes(value as SortMode) ? (value as SortMode) : 'none';
  } catch {
    return 'none';
  }
}

/** Sort order chosen on Серверы, remembered across launches and shared with Главная. */
export function useSortMode(): [SortMode, () => void] {
  const [mode, setMode] = useState<SortMode>(loadSortMode);
  const cycle = () => {
    const next = SORT_MODES[(SORT_MODES.indexOf(mode) + 1) % SORT_MODES.length];
    setMode(next);
    try {
      window.localStorage.setItem(SORT_STORAGE_KEY, next);
    } catch {
      // not persisted: the choice still applies for this session
    }
  };
  return [mode, cycle];
}
