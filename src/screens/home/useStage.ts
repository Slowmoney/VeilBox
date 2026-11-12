import { useEffect, useRef, useState } from 'react';
import type { ConnectionState } from '../../types';

export type StageState = 'disconnected' | 'connecting' | 'connected' | 'failed';

const MIN_CONNECTING_MS = 720;
const FAILED_SHOWN_MS = 2000;

/**
 * Display state of the power button. "Connecting" stays visible for a moment even
 * if the backend answers instantly, and a failure shows briefly before returning
 * to "disconnected".
 */
export function useStage(state: ConnectionState): StageState {
  const [stage, setStage] = useState<StageState>(state === 'error' ? 'disconnected' : state);
  const startedAt = useRef<number | null>(null);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    const clear = () => {
      if (timer.current != null) {
        window.clearTimeout(timer.current);
        timer.current = null;
      }
    };

    if (state === 'connecting') {
      clear();
      startedAt.current = Date.now();
      setStage('connecting');
      return clear;
    }

    const elapsed = startedAt.current ? Date.now() - startedAt.current : MIN_CONNECTING_MS;
    const remaining = Math.max(0, MIN_CONNECTING_MS - elapsed);

    if (state === 'error') {
      clear();
      timer.current = window.setTimeout(() => {
        setStage('failed');
        timer.current = window.setTimeout(() => {
          timer.current = null;
          startedAt.current = null;
          setStage('disconnected');
        }, FAILED_SHOWN_MS);
      }, remaining);
      return clear;
    }

    const next: StageState = state === 'connected' ? 'connected' : 'disconnected';
    clear();
    if (remaining > 0) {
      timer.current = window.setTimeout(() => {
        timer.current = null;
        startedAt.current = null;
        setStage(next);
      }, remaining);
      return clear;
    }
    startedAt.current = null;
    setStage(next);
    return clear;
  }, [state]);

  return stage;
}
