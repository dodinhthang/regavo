import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { initialLanguage, rememberLanguage, type Language } from './locale.ts';
import { translate, type TranslationValues } from './translate.ts';

type I18n = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (source: string, values?: TranslationValues) => string;
  number: (value: number) => string;
};
const Context = createContext<I18n | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, updateLanguage] = useState(() => {
    let storage: Storage | undefined;
    try {
      storage = window.localStorage;
    } catch {
      // Reading the storage property itself may be blocked.
    }
    return initialLanguage(
      storage,
      navigator.languages?.length ? navigator.languages : [navigator.language],
      document.documentElement.dataset.cfCountry,
    );
  });
  useEffect(() => {
    document.documentElement.lang = language;
    document.title = translate(language, 'Regavo · Chiến thuật thời gian thực');
  }, [language]);
  const value = useMemo<I18n>(() => {
    const formatter = new Intl.NumberFormat(language === 'vi' ? 'vi-VN' : language);
    return {
      language,
      setLanguage: (next) => {
        updateLanguage(next);
        try {
          rememberLanguage(window.localStorage, next);
        } catch {
          // Access to localStorage is optional, just as it is during initialization.
        }
      },
      t: (source, values) => translate(language, source, values),
      number: (number) => formatter.format(number),
    };
  }, [language]);
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useI18n(): I18n {
  const context = useContext(Context);
  if (!context) throw new Error('I18nProvider is missing');
  return context;
}
