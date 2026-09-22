'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from './Icon';
import type { Item, NetMode, Settings, User } from '@/lib/types';
import type { GroupWithItems } from '@/lib/api-client';
import { useI18n } from '@/i18n';

interface PaletteAction {
  id: string;
  label: string;
  icon: string;
  keywords?: string;
  run: () => void;
}

interface Props {
  open: boolean;
  onClose: () => void;
  user: User | null;
  items: Item[];
  groups: GroupWithItems[];
  settings: Settings;
  netMode: NetMode;
  actions: {
    openItem: (item: Item) => void;
    cycleTheme: () => void;
    switchNet: (mode: NetMode) => void;
    toggleEdit: () => void;
    newGroup: () => void;
    newItem: () => void;
    goSettings: () => void;
    goLogin: () => void;
    logout: () => void;
  };
}

type Result =
  | { section: 'search' | 'sites' | 'actions'; kind: 'action'; action: PaletteAction }
  | { section: 'sites'; kind: 'site'; item: Item; group: string };

export function CommandPalette({ open, onClose, user, items, groups, settings, netMode, actions }: Props) {
  const { t } = useI18n();
  const [query, setQuery] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const groupMap = useMemo(() => {
    const m = new Map<number, string>();
    groups.forEach((g) => m.set(g.id, g.name));
    return m;
  }, [groups]);

  const engines = settings.searchEngines?.length ? settings.searchEngines : [];
  const engine = engines.find((e) => e.id === settings.searchEngine) ?? engines[0];

  useEffect(() => {
    if (open) {
      setQuery('');
      setSel(0);
      // 等待渲染后聚焦输入
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  useEffect(() => {
    setSel(0);
  }, [query]);

  const staticActions: PaletteAction[] = useMemo(() => {
    const arr: PaletteAction[] = [];
    arr.push({ id: 'theme', label: t('common.theme'), icon: 'mdi:theme-light-dark', keywords: 'theme dark light 主题 暗 亮 夜间', run: actions.cycleTheme });
    arr.push({ id: 'lan', label: t('net.lan'), icon: 'mdi:lan', keywords: 'lan 内网 本地 局域网', run: () => actions.switchNet('lan') });
    arr.push({ id: 'wan', label: t('net.wan'), icon: 'mdi:web', keywords: 'wan 外网 公网 互联网', run: () => actions.switchNet('wan') });
    arr.push({ id: 'edit', label: t('home.editMode'), icon: 'mdi:pencil-outline', keywords: 'edit 编辑 管理 整理', run: actions.toggleEdit });
    if (user) arr.push({ id: 'newGroup', label: t('home.newGroup'), icon: 'mdi:folder-plus-outline', keywords: 'group 分组 新建 添加', run: actions.newGroup });
    if (user) arr.push({ id: 'newItem', label: t('home.newItem'), icon: 'mdi:plus-box-outline', keywords: 'new site 站点 新建 添加', run: actions.newItem });
    arr.push({ id: 'settings', label: t('home.settingsCenter'), icon: 'mdi:cog-outline', keywords: 'settings 设置 配置 偏好', run: actions.goSettings });
    if (user) arr.push({ id: 'logout', label: t('common.logout'), icon: 'mdi:logout', keywords: 'logout 退出 登出', run: actions.logout });
    else arr.push({ id: 'login', label: t('common.login'), icon: 'mdi:login', keywords: 'login 登录 登入', run: actions.goLogin });
    return arr;
  }, [user, actions, t]);

  const q = query.trim().toLowerCase();

  const siteResults = useMemo(() => {
    if (!q) return [] as Item[];
    return items
      .filter(
        (i) =>
          i.title.toLowerCase().includes(q) ||
          (i.desc ?? '').toLowerCase().includes(q) ||
          i.urlLan.toLowerCase().includes(q) ||
          (i.urlWan ?? '').toLowerCase().includes(q) ||
          (groupMap.get(i.groupId) ?? '').toLowerCase().includes(q),
      )
      .slice(0, 12);
  }, [q, items, groupMap]);

  const filteredActions = useMemo(() => {
    if (!q) return staticActions;
    return staticActions.filter((a) => `${a.label} ${a.keywords ?? ''}`.toLowerCase().includes(q));
  }, [q, staticActions]);

  const results: Result[] = useMemo(() => {
    const list: Result[] = [];
    if (q && engine) {
      const text = query.trim();
      list.push({
        section: 'search',
        kind: 'action',
        action: {
          id: 'web',
          label: t('palette.webSearch', { q: text }),
          icon: engine.icon || 'mdi:magnify',
          run: () => {
            const url = engine.url.includes('{q}')
              ? engine.url.replace('{q}', encodeURIComponent(text))
              : engine.url + encodeURIComponent(text);
            window.open(url, '_blank', 'noopener,noreferrer');
          },
        },
      });
    }
    siteResults.forEach((item) =>
      list.push({ section: 'sites', kind: 'site', item, group: groupMap.get(item.groupId) ?? '' }),
    );
    filteredActions.forEach((action) => list.push({ section: 'actions', kind: 'action', action }));
    return list;
  }, [q, engine, query, siteResults, filteredActions, groupMap, t]);

  if (!open) return null;

  const runResult = (r: Result) => {
    if (r.kind === 'site') actions.openItem(r.item);
    else r.action.run();
    onClose();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSel((s) => Math.min(s + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSel((s) => Math.max(s - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (results[sel]) runResult(results[sel]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  // 当前选中项滚动可见
  useEffect(() => {
    const el = listRef.current?.querySelector<HTMLElement>(`[data-idx="${sel}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [sel]);

  const sectionLabel = (s: Result['section']) =>
    s === 'search' ? t('palette.sectionSearch') : s === 'sites' ? t('palette.sectionSites') : t('palette.sectionActions');

  let lastSection: Result['section'] | null = null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal w-full max-w-xl overflow-hidden p-0"
        style={{ marginTop: '12vh' }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={onKeyDown}
      >
        <div className="flex items-center gap-2 border-b border-line px-4 py-3">
          <Icon icon="mdi:console-line" size={20} title={t('palette.title')} />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t('palette.placeholder')}
            className="min-w-0 flex-1 bg-transparent text-[15px] outline-none"
          />
          <kbd className="rounded border border-line px-1.5 py-0.5 text-[11px] text-muted">ESC</kbd>
        </div>

        <div ref={listRef} className="max-h-[55vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <div className="px-3 py-8 text-center text-[13px] text-muted">{t('palette.empty')}</div>
          ) : (
            results.map((r, idx) => {
              const showHeader = r.section !== lastSection;
              lastSection = r.section;
              return (
                <div key={r.kind === 'site' ? `s-${r.item.id}` : `a-${r.action.id}`}>
                  {showHeader ? (
                    <div className="px-2 pb-1 pt-2 text-[11px] uppercase tracking-wide text-muted">{sectionLabel(r.section)}</div>
                  ) : null}
                  <button
                    type="button"
                    data-idx={idx}
                    onMouseMove={() => setSel(idx)}
                    onClick={() => runResult(r)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[14px] ${
                      idx === sel ? 'bg-brand/15' : 'hover:bg-brand/10'
                    }`}
                  >
                    <Icon
                      icon={r.kind === 'site' ? r.item.icon || 'mdi:web' : r.action.icon}
                      size={20}
                      title={r.kind === 'site' ? r.item.title : r.action.label}
                    />
                    <span className="truncate">
                      {r.kind === 'site' ? r.item.title : r.action.label}
                    </span>
                    {r.kind === 'site' && r.group ? (
                      <span className="ml-auto truncate text-[12px] text-muted">{r.group}</span>
                    ) : null}
                    {r.kind === 'site' ? (
                      <span className="ml-auto hidden truncate text-[12px] text-muted sm:block">
                        {r.item.urlWan || r.item.urlLan}
                      </span>
                    ) : null}
                  </button>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}
