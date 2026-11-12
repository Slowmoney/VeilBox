import type { AppLanguage } from '../types';

/** Picks the Russian or the English variant. */
export function tx(language: AppLanguage, ru: string, en: string) {
  return language === 'ru' ? ru : en;
}
