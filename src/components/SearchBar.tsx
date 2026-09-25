'use client';

import { useEffect, useMemo, useState } from 'react';
import { Icon } from './Icon';
import type { Item, Settings } from '@/lib/types';
import { useI18n } from '@/i18n';

const ENGINE_STORAGE_KEY = 'navideck-search-engine';

interface Props {
  settings: Settings;
  items: Item[];
  onOpenItem: (item: Item) => void;
}

export function SearchBar({ settings, items, onOpenItem }: Props) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [engineId, setEngineId] = useState(settings.searchEngine);
  const [engineOpen, setEngineOpen] = useState(false);
  const engines = settings.searchEngines?.length ? settings.searchEngines : [];
  const engine = engines.find((e) => e.id === engineId) ?? engines[0];

  // 记住上次手动切换的引擎（刷新/下次访问仍用用户最后选的）
  useEffect(() => {
    try {
      const saved = localStorage.getItem(ENGINE_STORAGE_KEY);
      if (saved && engines.some((e) => e.id === saved)) setEngineId(saved);
    } catch {
      /* 隐私模式忽略 */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [engines]);

  const pickEngine = (id: string) => {
    setEngineId(id);
    setEngineOpen(false);
    try {
      localStorage.setItem(ENGINE_STORAGE_KEY, id);
    } catch {
      /* 忽略 */
    }
  };

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return items
      .filter((i) => i.title.toLowerCase().includes(q) || (i.desc ?? '').toLowerCase().includes(q))
      .slice(0, 8);
  }, [query, items]);

  const submit = () => {
    const q = query.trim();
    if (!q || !engine) return;
    const url = engine.url.includes('{q}')
      ? engine.url.replace('{q}', encodeURIComponent(q))
      : engine.url + encodeURIComponent(q);
    window.open(url, '_blank', 'noopener');
  };

  if (!settings.searchEnabled) return null;

  const boxStyle: React.CSSProperties = {
    width: '100%',
    maxWidth: settings.searchWidth || 520,
    borderRadius: settings.searchRadius ?? 999,
    background: settings.searchBg || 'rgb(var(--surface) / .72)',
    color: settings.searchText || undefined,
  };

  return (
    <div className="relative mx-auto w-full" style={{ maxWidth: settings.searchWidth || 520 }}>
      <div
        className="search-box flex items-center gap-2 border border-line px-3 py-2 shadow-card"
        style={boxStyle}
      >
        {engines.length ? (
          <button
            type="button"
            className="flex h-6 w-6 flex-none items-center justify-center rounded-full hover:bg-brand/10"
            title={engine?.name ?? t('common.searchEngine')}
            onClick={() => setEngineOpen((v) => !v)}
          >
            <Icon icon={engine?.icon} size={18} title={engine?.name} />
          </button>
        ) : null}

        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') submit();
            if (e.key === 'Escape') setQuery('');
          }}
          placeholder={settings.searchPlaceholder || t('search.placeholder')}
          className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-muted"
          style={{ color: settings.searchText || undefined }}
        />

        <button type="button" onClick={submit} className="flex-none text-muted hover:text-brand" title={t('common.search')}>
          <Icon icon="mdi:magnify" size={20} title={t('common.search')} />
        </button>
      </div>

      {engineOpen && engines.length ? (
        <div className="absolute left-0 top-[calc(100%+6px)] z-30 w-56 rounded-xl border border-line bg-surface p-2 shadow-card">
          {engines.map((e) => (
            <button
              key={e.id}
              type="button"
              onClick={() => {
                setEngineId(e.id);
                setEngineOpen(false);
              }}
              className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-[13px] hover:bg-brand/10"
            >
              <Icon icon={e.icon} size={18} title={e.name} />
              {e.name}
            </button>
          ))}
        </div>
      ) : null}

      {matches.length ? (
        <div className="absolute left-0 top-[calc(100%+6px)] z-20 w-full overflow-hidden rounded-xl border border-line bg-surface shadow-card">
          {matches.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => {
                onOpenItem(item);
                setQuery('');
              }}
              className="flex w-full items-center gap-2 px-3 py-2 text-left text-[13px] hover:bg-brand/10"
            >
              <Icon icon={item.icon} size={18} title={item.title} />
              <span className="truncate">{item.title}</span>
              <span className="ml-auto truncate text-[12px] text-muted">{item.desc || item.urlLan}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
