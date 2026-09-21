'use client';

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import zhCN from './locales/zh-CN';
import enUS from './locales/en-US';

export type Lang = 'zh-CN' | 'en-US';

const dicts: Record<Lang, Record<string, string>> = {
  'zh-CN': zhCN,
  'en-US': enUS,
};

export const LANGS: Array<{ id: Lang; label: string }> = [
  { id: 'zh-CN', label: '简体中文' },
  { id: 'en-US', label: 'English' },
];

export function normalizeLang(value?: string | null): Lang {
  if (!value) return 'zh-CN';
  if (value.startsWith('en')) return 'en-US';
  if (value.startsWith('zh')) return 'zh-CN';
  return dicts[value as Lang] ? (value as Lang) : 'zh-CN';
}

export function translate(lang: Lang, key: string, params?: Record<string, string | number>): string {
  const dict = dicts[lang] ?? dicts['zh-CN'];
  let text = dict[key] ?? dicts['zh-CN'][key] ?? key;
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v));
    }
  }
  return text;
}

interface I18nValue {
  lang: Lang;
  t: (key: string, params?: Record<string, string | number>) => string;
  setLang: (lang: Lang) => void;
}

const I18nContext = createContext<I18nValue>({
  lang: 'zh-CN',
  t: (key) => key,
  setLang: () => undefined,
});

export function I18nProvider({ lang, children }: { lang?: string | null; children: ReactNode }) {
  const [current, setCurrent] = useState<Lang>(() => normalizeLang(lang));

  const setLang = (next: Lang) => {
    setCurrent(next);
    try {
      localStorage.setItem('navideck-lang', next);
    } catch {
      /* 忽略隐私模式下的写入失败 */
    }
  };

  const value = useMemo<I18nValue>(
    () => ({
      lang: current,
      setLang,
      t: (key, params) => translate(current, key, params),
    }),
    [current],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  return useContext(I18nContext);
}
