import { readProjectStorage, STORAGE_KEYS } from '../storage.ts';

export const LANGUAGES = ['vi', 'en', 'zh-CN'] as const;
export type Language = (typeof LANGUAGES)[number];
export const LANGUAGE_KEY = STORAGE_KEYS.language;

export function isLanguage(value: unknown): value is Language {
  return LANGUAGES.some((language) => language === value);
}

/** An explicit choice wins; otherwise use the first supported browser preference. */
export function resolveLanguage(saved: unknown, browserLanguages: readonly string[]): Language {
  if (isLanguage(saved)) return saved;
  for (const preference of browserLanguages) {
    const language = preference.toLowerCase().split(/[-_]/)[0];
    if (language === 'vi') return 'vi';
    if (language === 'en') return 'en';
    if (language === 'zh') return 'zh-CN';
  }
  return 'en';
}

export function initialLanguage(
  storage: Pick<Storage, 'getItem'> | undefined,
  browserLanguages: readonly string[],
): Language {
  const saved = readProjectStorage(storage, LANGUAGE_KEY);
  return resolveLanguage(saved, browserLanguages);
}

export function rememberLanguage(storage: Pick<Storage, 'setItem'>, language: Language): void {
  try {
    storage.setItem(LANGUAGE_KEY, language);
  } catch {
    // The current session can switch languages even when preferences cannot be saved.
  }
}
