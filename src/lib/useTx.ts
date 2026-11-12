import { useAppStore } from '../store/useAppStore';
import { tx } from './text';

/** `tx` bound to the language from settings. */
export function useTx() {
  const language = useAppStore((state) => state.settings.language);
  return (ru: string, en: string) => tx(language, ru, en);
}
