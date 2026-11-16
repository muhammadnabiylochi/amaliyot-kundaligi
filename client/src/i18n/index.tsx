import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ru } from './ru';

export type Lang = 'uz' | 'ru';

interface I18nContextValue {
  lang: Lang;
  setLang: (l: Lang) => void;
  /** Translate an Uzbek source string. Falls back to Uzbek when no translation exists. */
  t: (text: string, vars?: Record<string, string | number>) => string;
}

const STORAGE_KEY = 'app_lang';

function readStoredLang(): Lang {
  try {
    const v = localStorage.getItem(STORAGE_KEY);
    return v === 'ru' ? 'ru' : 'uz';
  } catch {
    return 'uz';
  }
}

function interpolate(s: string, vars?: Record<string, string | number>): string {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

const I18nContext = createContext<I18nContextValue>({
  lang: 'uz',
  setLang: () => undefined,
  t: (s, v) => interpolate(s, v),
});

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readStoredLang);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    try {
      localStorage.setItem(STORAGE_KEY, l);
    } catch {
      /* storage unavailable */
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang === 'ru' ? 'ru' : 'uz';
  }, [lang]);

  const t = useCallback(
    (text: string, vars?: Record<string, string | number>) => interpolate(lang === 'ru' ? ru[text] ?? text : text, vars),
    [lang],
  );

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  return useContext(I18nContext);
}
