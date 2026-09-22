'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, type SystemStatus } from '@/lib/api-client';
import { Icon } from './Icon';
import { DockerPanel } from './DockerPanel';
import { MetricsPanel } from './MetricsPanel';
import type { Role, SearchEngine, Settings, UploadedFile, User } from '@/lib/types';
import { useI18n, LANGS, type Lang } from '@/i18n';

type Tab = 'appearance' | 'search' | 'custom' | 'data' | 'users' | 'status' | 'docker' | 'metrics' | 'about';

const TABS: Array<{ id: Tab; icon: string; adminOnly?: boolean }> = [
  { id: 'appearance', icon: 'mdi:palette-outline' },
  { id: 'search', icon: 'mdi:magnify' },
  { id: 'custom', icon: 'mdi:code-braces' },
  { id: 'data', icon: 'mdi:database-outline' },
  { id: 'users', icon: 'mdi:account-multiple-outline', adminOnly: true },
  { id: 'status', icon: 'mdi:chart-box-outline' },
  { id: 'docker', icon: 'mdi:docker', adminOnly: true },
  { id: 'metrics', icon: 'mdi:chart-line' },
  { id: 'about', icon: 'mdi:information-outline' },
];

interface Props {
  user: User;
  initialSettings: Settings;
  users: User[];
}

export function SettingsPanel({ user, initialSettings, users: initialUsers }: Props) {
  const { t, setLang } = useI18n();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('appearance');
  const [settings, setSettings] = useState<Settings>(initialSettings);
  const [users, setUsers] = useState<User[]>(initialUsers);
  const [as, setAs] = useState<number | null>(null);
  const [isGlobal, setIsGlobal] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const isAdmin = user.role === 'admin';

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2200);
    return () => clearTimeout(timer);
  }, [toast]);

  const reload = async (nextAs: number | null, nextGlobal: boolean) => {
    try {
      setSettings(await api.settings(nextAs ?? undefined, nextGlobal));
    } catch {
      setToast(t('settings.loadFailed'));
    }
  };

  const save = async (patch: Partial<Settings>) => {
    setSettings((prev) => ({ ...prev, ...patch }));
    try {
      const saved = await api.saveSettings(patch, as ?? undefined, isGlobal);
      setSettings(saved);
    } catch (err) {
      setToast(err instanceof Error ? err.message : t('common.saveFailed'));
    }
  };

  const selectTarget = async (value: string) => {
    if (value === 'global') {
      setAs(null);
      setIsGlobal(true);
      await reload(null, true);
      return;
    }
    const id = value === 'self' ? null : Number(value);
    setAs(id);
    setIsGlobal(false);
    await reload(id, false);
  };

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <button className="btn btn-ghost" onClick={() => router.push('/')}>
          <Icon icon="mdi:arrow-left" size={18} title={t('common.backHome')} />
          {t('common.backHome')}
        </button>
        <h1 className="text-[17px] font-medium">{t('settings.title')}</h1>

        {isAdmin ? (
          <select
            className="field ml-auto w-auto"
            value={isGlobal ? 'global' : as === null ? 'self' : String(as)}
            onChange={(e) => selectTarget(e.target.value)}
          >
            <option value="self">{t('settings.targetSelf')}</option>
            <option value="global">{t('settings.targetGlobal')}</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.role === 'guest' ? t('home.editGuest') : t('users.userLabel', { name: u.username })}
              </option>
            ))}
          </select>
        ) : null}
      </div>

      <div className="mb-5 flex flex-wrap gap-1.5">
        {TABS.filter((tabMeta) => !tabMeta.adminOnly || isAdmin).map((tabMeta) => (
          <button
            key={tabMeta.id}
            onClick={() => setTab(tabMeta.id)}
            className={`btn ${tab === tabMeta.id ? 'btn-primary' : ''}`}
          >
            <Icon icon={tabMeta.icon} size={17} title={t(`tab.${tabMeta.id}`)} />
            {t(`tab.${tabMeta.id}`)}
          </button>
        ))}
      </div>

      <div className="card p-5">
        {tab === 'appearance' ? (
          <AppearanceTab settings={settings} onSave={save} setLang={setLang} />
        ) : null}
        {tab === 'search' ? <SearchTab settings={settings} onSave={save} /> : null}
        {tab === 'custom' ? <CustomTab settings={settings} onSave={save} /> : null}
        {tab === 'data' ? (
          <DataTab
            toast={setToast}
            as={as}
            isGlobal={isGlobal}
            settings={settings}
            onSave={save}
          />
        ) : null}
        {tab === 'users' && isAdmin ? (
          <UsersTab users={users} setUsers={setUsers} current={user} toast={setToast} />
        ) : null}
        {tab === 'status' ? <StatusTab /> : null}
        {tab === 'docker' && isAdmin ? <DockerPanel toast={setToast} /> : null}
        {tab === 'metrics' ? <MetricsPanel /> : null}
        {tab === 'about' ? <AboutTab /> : null}
      </div>

      {toast ? (
        <div className="pointer-events-none fixed bottom-6 left-1/2 z-[60] -translate-x-1/2 rounded-xl border border-line bg-surface px-4 py-2 text-[13px] shadow-card">
          {toast}
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------ 通用小组件 ------------------------------ */

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 border-b border-line/60 py-3 last:border-0">
      <div className="min-w-[150px]">
        <div className="text-[13px]">{label}</div>
        {hint ? <div className="text-[11px] text-muted">{hint}</div> : null}
      </div>
      <div className="ml-auto flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

function Switch({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      className="relative h-6 w-11 rounded-full transition"
      style={{ background: value ? 'rgb(var(--brand))' : 'rgb(var(--line))' }}
    >
      <span
        className="absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all"
        style={{ left: value ? 22 : 2 }}
      />
    </button>
  );
}

function Num({
  value,
  onChange,
  min = 0,
  max = 999,
  suffix,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  suffix?: string;
}) {
  return (
    <div className="flex items-center gap-1.5">
      <input
        type="range"
        min={min}
        max={max}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="w-32 accent-[rgb(var(--brand))]"
      />
      <span className="w-12 text-right text-[12px] text-muted">
        {value}
        {suffix}
      </span>
    </div>
  );
}

/* ------------------------------ 外观 ------------------------------ */

function AppearanceTab({
  settings,
  onSave,
  setLang,
}: {
  settings: Settings;
  onSave: (p: Partial<Settings>) => void;
  setLang: (lang: Lang) => void;
}) {
  const { t } = useI18n();
  const changeLang = (next: Lang) => {
    onSave({ lang: next });
    setLang(next);
  };
  return (
    <div>
      <Row label={t('appearance.siteTitle')}>
        <input className="field w-56" value={settings.siteTitle} onChange={(e) => onSave({ siteTitle: e.target.value })} />
      </Row>

      <Row label={t('appearance.theme')} hint={t('appearance.themeHint')}>
        <div className="flex rounded-xl border border-line p-0.5 text-[13px]">
          {(['auto', 'light', 'dark'] as const).map((m) => (
            <button
              key={m}
              className={`rounded-lg px-3 py-1 ${settings.theme === m ? 'bg-brand text-white' : 'text-muted'}`}
              onClick={() => onSave({ theme: m })}
            >
              {m === 'auto' ? t('theme.auto') : m === 'light' ? t('theme.light') : t('theme.dark')}
            </button>
          ))}
        </div>
      </Row>

      <Row label={t('appearance.accent')}>
        <input
          type="color"
          value={settings.accent}
          onChange={(e) => onSave({ accent: e.target.value })}
          className="h-8 w-14 cursor-pointer rounded border border-line bg-transparent"
        />
        <input className="field w-28" value={settings.accent} onChange={(e) => onSave({ accent: e.target.value })} />
      </Row>

      <Row label={t('appearance.bgImage')} hint={t('appearance.bgImageHint')}>
        <input
          className="field w-64"
          placeholder="https://…/bg.jpg"
          value={settings.bgImage}
          onChange={(e) => onSave({ bgImage: e.target.value })}
        />
      </Row>

      <Row label={t('appearance.language')}>
        <select className="field w-40" value={settings.lang} onChange={(e) => changeLang(e.target.value as Lang)}>
          {LANGS.map((l) => (
            <option key={l.id} value={l.id}>
              {l.label}
            </option>
          ))}
        </select>
      </Row>

      <Row label={t('appearance.columns')}>
        <Num value={settings.columns} min={2} max={12} onChange={(v) => onSave({ columns: v })} />
      </Row>

      <Row label={t('appearance.cardRadius')}>
        <Num value={settings.cardRadius} min={0} max={28} suffix="px" onChange={(v) => onSave({ cardRadius: v })} />
      </Row>

      <Row label={t('appearance.cardOpacity')}>
        <Num value={settings.cardOpacity} min={30} max={100} suffix="%" onChange={(v) => onSave({ cardOpacity: v })} />
      </Row>

      <Row label={t('appearance.iconSize')}>
        <Num value={settings.iconSize} min={20} max={64} suffix="px" onChange={(v) => onSave({ iconSize: v })} />
      </Row>

      <Row label={t('appearance.showDesc')}>
        <Switch value={settings.showDesc} onChange={(v) => onSave({ showDesc: v })} />
      </Row>

      <Row label={t('appearance.footer')}>
        <Switch value={settings.footerEnabled} onChange={(v) => onSave({ footerEnabled: v })} />
        <input
          className="field w-64"
          placeholder={t('appearance.footerPlaceholder')}
          value={settings.footerText}
          onChange={(e) => onSave({ footerText: e.target.value })}
        />
      </Row>

      <Row label={t('appearance.netMode')}>
        <div className="flex rounded-xl border border-line p-0.5 text-[13px]">
          {(['lan', 'wan'] as const).map((m) => (
            <button
              key={m}
              className={`rounded-lg px-3 py-1 ${settings.netMode === m ? 'bg-brand text-white' : 'text-muted'}`}
              onClick={() => onSave({ netMode: m })}
            >
              {m === 'lan' ? t('net.lan') : t('net.wan')}
            </button>
          ))}
        </div>
      </Row>

      <Row label={t('appearance.guest')} hint={t('appearance.guestHint')}>
        <Switch value={settings.guestEnabled} onChange={(v) => onSave({ guestEnabled: v })} />
      </Row>

      <Row label={t('appearance.widgets')} hint={t('appearance.widgetsHint')}>
        <Switch value={settings.widgetsEnabled} onChange={(v) => onSave({ widgetsEnabled: v })} />
      </Row>

      <Row label={t('appearance.widgetPosition')}>
        <div className="flex rounded-xl border border-line p-0.5 text-[13px]">
          {(['top', 'bottom'] as const).map((p) => (
            <button
              key={p}
              className={`rounded-lg px-3 py-1 ${settings.widgetPosition === p ? 'bg-brand text-white' : 'text-muted'}`}
              onClick={() => onSave({ widgetPosition: p })}
            >
              {p === 'top' ? t('appearance.positionTop') : t('appearance.positionBottom')}
            </button>
          ))}
        </div>
      </Row>

      <Row label={t('appearance.widgetSystem')}>
        <Switch value={settings.widgetSystem} onChange={(v) => onSave({ widgetSystem: v })} />
      </Row>

      <Row label={t('appearance.widgetDocker')} hint={t('appearance.widgetDockerHint')}>
        <Switch value={settings.widgetDocker} onChange={(v) => onSave({ widgetDocker: v })} />
      </Row>

      <Row label={t('appearance.widgetRefresh')}>
        <Num
          value={settings.widgetRefresh}
          min={5}
          max={120}
          suffix={t('common.second')}
          onChange={(v) => onSave({ widgetRefresh: v })}
        />
      </Row>
    </div>
  );
}

/* ------------------------------ 搜索 ------------------------------ */

function SearchTab({ settings, onSave }: { settings: Settings; onSave: (p: Partial<Settings>) => void }) {
  const { t } = useI18n();
  const engines = settings.searchEngines ?? [];

  const updateEngines = (next: SearchEngine[]) => onSave({ searchEngines: next });

  return (
    <div>
      <Row label={t('search.enabled')}>
        <Switch value={settings.searchEnabled} onChange={(v) => onSave({ searchEnabled: v })} />
      </Row>

      <Row label={t('search.placeholderLabel')}>
        <input
          className="field w-56"
          value={settings.searchPlaceholder}
          onChange={(e) => onSave({ searchPlaceholder: e.target.value })}
        />
      </Row>

      <Row label={t('search.defaultEngine')}>
        <select
          className="field w-40"
          value={settings.searchEngine}
          onChange={(e) => onSave({ searchEngine: e.target.value })}
        >
          {engines.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </Row>

      <Row label={t('search.width')}>
        <Num value={settings.searchWidth} min={240} max={900} suffix="px" onChange={(v) => onSave({ searchWidth: v })} />
      </Row>

      <Row label={t('search.radius')}>
        <Num value={settings.searchRadius} min={0} max={999} suffix="px" onChange={(v) => onSave({ searchRadius: v })} />
      </Row>

      <Row label={t('search.bgColor')} hint={t('search.followTheme')}>
        <input
          type="color"
          value={settings.searchBg || '#ffffff'}
          onChange={(e) => onSave({ searchBg: e.target.value })}
          className="h-8 w-14 cursor-pointer rounded border border-line bg-transparent"
        />
        <button className="btn" onClick={() => onSave({ searchBg: '' })}>
          {t('search.followTheme')}
        </button>
      </Row>

      <Row label={t('search.textColor')} hint={t('search.followTheme')}>
        <input
          type="color"
          value={settings.searchText || '#111827'}
          onChange={(e) => onSave({ searchText: e.target.value })}
          className="h-8 w-14 cursor-pointer rounded border border-line bg-transparent"
        />
        <button className="btn" onClick={() => onSave({ searchText: '' })}>
          {t('search.followTheme')}
        </button>
      </Row>

      <div className="mt-5 border-t border-line pt-4">
        <div className="mb-3 flex items-center">
          <h3 className="text-[14px] font-medium">{t('search.engines')}</h3>
          <button
            className="btn ml-auto"
            onClick={() =>
              updateEngines([
                ...engines,
                { id: `e${Date.now()}`, name: t('search.newEngine'), url: 'https://example.com/search?q={q}', icon: 'mdi:magnify' },
              ])
            }
          >
            <Icon icon="mdi:plus" size={16} title={t('common.add')} />
            {t('search.newEngine')}
          </button>
        </div>

        <div className="space-y-2">
          {engines.map((engine, index) => (
            <div key={engine.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line p-2">
              <input
                className="field w-24"
                value={engine.name}
                onChange={(e) => updateEngines(engines.map((x, i) => (i === index ? { ...x, name: e.target.value } : x)))}
              />
              <input
                className="field min-w-[220px] flex-1"
                value={engine.url}
                placeholder={t('search.urlPlaceholder')}
                onChange={(e) => updateEngines(engines.map((x, i) => (i === index ? { ...x, url: e.target.value } : x)))}
              />
              <input
                className="field w-44"
                value={engine.icon}
                placeholder={t('search.iconPlaceholder')}
                onChange={(e) => updateEngines(engines.map((x, i) => (i === index ? { ...x, icon: e.target.value } : x)))}
              />
              <button
                className="btn btn-ghost text-red-500"
                onClick={() => updateEngines(engines.filter((_, i) => i !== index))}
              >
                <Icon icon="mdi:trash-can-outline" size={17} title={t('common.delete')} />
              </button>
            </div>
          ))}
        </div>
        <p className="mt-2 text-[12px] text-muted">{t('search.qTip')}</p>
      </div>
    </div>
  );
}

/* ------------------------------ 自定义代码 ------------------------------ */

function CustomTab({ settings, onSave }: { settings: Settings; onSave: (p: Partial<Settings>) => void }) {
  const { t } = useI18n();
  return (
    <div className="space-y-5">
      <div>
        <div className="mb-1.5 flex items-center">
          <h3 className="text-[14px] font-medium">{t('custom.css')}</h3>
          <button className="btn ml-auto" onClick={() => onSave({ customCss: settings.customCss })}>
            {t('custom.apply')}
          </button>
        </div>
        <textarea
          className="field h-48 font-mono text-[12px]"
          placeholder={t('custom.cssPlaceholder')}
          value={settings.customCss}
          onChange={(e) => onSave({ customCss: e.target.value })}
        />
      </div>

      <div>
        <div className="mb-1.5 flex items-center">
          <h3 className="text-[14px] font-medium">{t('custom.js')}</h3>
          <button className="btn ml-auto" onClick={() => onSave({ customJs: settings.customJs })}>
            {t('custom.apply')}
          </button>
        </div>
        <textarea
          className="field h-48 font-mono text-[12px]"
          placeholder={t('custom.jsPlaceholder')}
          value={settings.customJs}
          onChange={(e) => onSave({ customJs: e.target.value })}
        />
        <p className="mt-2 text-[12px] text-muted">{t('custom.tip')}</p>
      </div>
    </div>
  );
}

/* ------------------------------ 数据与文件 ------------------------------ */

function DataTab({
  toast,
  as,
  isGlobal,
  settings,
  onSave,
}: {
  toast: (msg: string) => void;
  as: number | null;
  isGlobal: boolean;
  settings: Settings;
  onSave: (p: Partial<Settings>) => void;
}) {
  const { t } = useI18n();
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const fileInput = useRef<HTMLInputElement>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const bookmarkInput = useRef<HTMLInputElement>(null);
  const [backups, setBackups] = useState<Array<{ name: string; size: number; createdAt: number }>>([]);
  const [busy, setBusy] = useState(false);
  const [bookmarkMode, setBookmarkMode] = useState<'replace' | 'append'>('append');
  const query = as ? `?as=${as}` : '';

  const loadFiles = async () => {
    try {
      setFiles(await api.listFiles(as ?? undefined));
    } catch {
      /* 忽略 */
    }
  };

  const loadBackups = async () => {
    try {
      setBackups((await api.backupList()).backups);
    } catch {
      /* 忽略 */
    }
  };

  useEffect(() => {
    void loadBackups();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [as]);

  const doImportBookmarks = async (file: File, mode: 'replace' | 'append') => {
    try {
      const res = await api.importBookmarks(file, mode, as ?? undefined);
      toast(t('data.imported', { g: res.groupCount, i: res.itemCount }));
    } catch (err) {
      toast(err instanceof Error ? err.message : t('data.importFailed'));
    }
  };

  useEffect(() => {
    void loadFiles();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [as]);

  const upload = async (file: File) => {
    try {
      const res = await api.uploadFile(file, as ?? undefined);
      toast(res.dedup ? t('data.deduped') : t('data.uploaded'));
      await loadFiles();
    } catch {
      toast(t('common.uploadFailed'));
    }
  };

  const doImport = async (file: File, mode: 'replace' | 'append') => {
    try {
      const text = await file.text();
      const payload = JSON.parse(text);
      const res = await api.importData(payload, mode, as ?? undefined);
      toast(t('data.imported', { g: res.groupCount, i: res.itemCount }));
    } catch {
      toast(t('data.importFailed'));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="mb-2 text-[14px] font-medium">{t('data.backup')}</h3>
        <div className="flex flex-wrap gap-2">
          <a className="btn" href={`/api/export${query}`} download>
            <Icon icon="mdi:export" size={17} title={t('data.export')} />
            {t('data.export')}
          </a>
          <button className="btn" onClick={() => importInput.current?.click()}>
            <Icon icon="mdi:import" size={17} title={t('data.importMerge')} />
            {t('data.importMerge')}
          </button>
          <button
            className="btn"
            onClick={() => {
              if (confirm(t('data.importConfirm'))) importInput.current?.click();
            }}
          >
            {t('data.importReplace')}
          </button>
        </div>
        <input
          ref={importInput}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void doImport(file, 'append');
            e.target.value = '';
          }}
        />
        <p className="mt-2 text-[12px] text-muted">{t('data.tip')}</p>
      </div>

      <div className="border-t border-line pt-5">
        <h3 className="mb-2 text-[14px] font-medium">{t('data.bookmarks')}</h3>
        <div className="flex flex-wrap gap-2">
          <button
            className="btn"
            onClick={() => {
              setBookmarkMode('append');
              bookmarkInput.current?.click();
            }}
          >
            <Icon icon="mdi:bookmark-outline" size={17} title={t('data.importBookmarks')} />
            {t('data.importBookmarks')}
          </button>
          <button
            className="btn"
            onClick={() => {
              if (confirm(t('data.importConfirm'))) {
                setBookmarkMode('replace');
                bookmarkInput.current?.click();
              }
            }}
          >
            {t('data.bookmarksReplace')}
          </button>
        </div>
        <input
          ref={bookmarkInput}
          type="file"
          accept=".html,text/html"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void doImportBookmarks(file, bookmarkMode);
            e.target.value = '';
          }}
        />
        <p className="mt-2 text-[12px] text-muted">{t('data.importBookmarksTip')}</p>
      </div>

      <div className="border-t border-line pt-5">
        <h3 className="mb-2 text-[14px] font-medium">{t('data.backupManage')}</h3>
        <div className="flex flex-wrap items-center gap-2">
          <button
            className="btn"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api.backupNow();
                await loadBackups();
                toast(t('data.backupCreated'));
              } catch {
                toast(t('data.backupFailed'));
              } finally {
                setBusy(false);
              }
            }}
          >
            <Icon icon="mdi:backup-restore" size={17} title={t('data.backupNow')} />
            {t('data.backupNow')}
          </button>
          <Row label={t('data.backupInterval')} hint={t('data.backupIntervalHint')}>
            <input
              type="number"
              min={0}
              max={8760}
              className="field w-24"
              value={settings.backupInterval}
              onChange={(e) => onSave({ backupInterval: Number(e.target.value) })}
            />
          </Row>
        </div>
        {backups.length === 0 ? (
          <p className="mt-3 text-[13px] text-muted">{t('data.noBackups')}</p>
        ) : (
          <div className="mt-3 space-y-2">
            {backups.map((b) => (
              <div
                key={b.name}
                className="flex flex-wrap items-center gap-2 rounded-xl border border-line p-2 text-[13px]"
              >
                <Icon icon="mdi:database-outline" size={18} title={t('data.backupManage')} />
                <span className="max-w-[200px] truncate">{b.name}</span>
                <span className="text-[12px] text-muted">{(b.size / 1024).toFixed(1)} KB</span>
                <span className="text-[12px] text-muted">{new Date(b.createdAt).toLocaleString()}</span>
                <a
                  className="btn btn-ghost ml-auto"
                  href={`/api/backup/download?name=${encodeURIComponent(b.name)}${query}`}
                  download
                >
                  {t('common.download')}
                </a>
                <button
                  className="btn btn-ghost"
                  onClick={async () => {
                    if (!confirm(t('data.restoreConfirm'))) return;
                    try {
                      await api.backupRestore(b.name);
                      toast(t('data.restored'));
                      window.location.reload();
                    } catch (err) {
                      toast(err instanceof Error ? err.message : t('data.backupFailed'));
                    }
                  }}
                >
                  {t('data.restore')}
                </button>
                <button
                  className="btn btn-ghost text-red-500"
                  onClick={async () => {
                    try {
                      await api.backupDelete(b.name);
                      setBackups(backups.filter((x) => x.name !== b.name));
                      toast(t('data.backupDeleted'));
                    } catch {
                      toast(t('data.backupFailed'));
                    }
                  }}
                >
                  <Icon icon="mdi:trash-can-outline" size={17} title={t('common.delete')} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-line pt-5">
        <div className="mb-2 flex items-center">
          <h3 className="text-[14px] font-medium">{t('data.files')}</h3>
          <button className="btn ml-auto" onClick={() => fileInput.current?.click()}>
            <Icon icon="mdi:upload" size={17} title={t('data.upload')} />
            {t('data.upload')}
          </button>
        </div>
        <input
          ref={fileInput}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
            e.target.value = '';
          }}
        />
        <p className="mb-3 text-[12px] text-muted">{t('data.fileTip')}</p>

        {files.length === 0 ? (
          <p className="py-4 text-center text-[13px] text-muted">{t('data.noFiles')}</p>
        ) : (
          <div className="space-y-2">
            {files.map((f) => {
              const url = `${location.origin}/api/files/${f.path}`;
              return (
                <div key={f.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line p-2 text-[13px]">
                  <Icon icon="mdi:file-outline" size={18} title={t('common.file')} />
                  <span className="max-w-[220px] truncate">{f.name}</span>
                  <span className="text-[12px] text-muted">{(f.size / 1024).toFixed(1)} KB</span>
                  {f.refCount > 1 ? <span className="chip">{t('data.reused', { n: f.refCount })}</span> : null}
                  <button
                    className="btn btn-ghost ml-auto"
                    onClick={() => {
                      void navigator.clipboard.writeText(url);
                      toast(t('data.linkCopied'));
                    }}
                  >
                    {t('data.copyLink')}
                  </button>
                  <button
                    className="btn btn-ghost text-red-500"
                    onClick={async () => {
                      await api.deleteFile(f.id, as ?? undefined);
                      await loadFiles();
                      toast(t('common.deleted'));
                    }}
                  >
                    <Icon icon="mdi:trash-can-outline" size={17} title={t('common.delete')} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="border-t border-line pt-5">
        <h3 className="mb-2 text-[14px] font-medium">{t('data.reset')}</h3>
        <button
          className="btn btn-danger"
          onClick={async () => {
            if (!confirm(t('data.resetConfirm'))) return;
            await fetch(`/api/settings/reset${as ? `?as=${as}` : ''}`, { method: 'POST' });
            window.location.reload();
          }}
        >
          {t('data.reset')}
        </button>
        <p className="mt-2 text-[12px] text-muted">{t('data.resetTip')}</p>
      </div>
    </div>
  );
}

/* ------------------------------ 账号 ------------------------------ */

function UsersTab({
  users,
  setUsers,
  current,
  toast,
}: {
  users: User[];
  setUsers: (u: User[]) => void;
  current: User;
  toast: (msg: string) => void;
}) {
  const { t } = useI18n();
  const [form, setForm] = useState({ username: '', password: '', role: 'user' as Role });
  const [editPw, setEditPw] = useState<{ id: number; password: string } | null>(null);

  const reload = async () => setUsers(await api.users());

  return (
    <div className="space-y-5">
      <div>
        <h3 className="mb-2 text-[14px] font-medium">{t('users.add')}</h3>
        <div className="flex flex-wrap gap-2">
          <input
            className="field w-40"
            placeholder={t('users.username')}
            value={form.username}
            onChange={(e) => setForm({ ...form, username: e.target.value })}
          />
          <input
            className="field w-40"
            type="password"
            placeholder={t('users.password')}
            value={form.password}
            onChange={(e) => setForm({ ...form, password: e.target.value })}
          />
          <select
            className="field w-28"
            value={form.role}
            onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
          >
            <option value="user">{t('users.roleUser')}</option>
            <option value="admin">{t('users.roleAdmin')}</option>
          </select>
          <button
            className="btn btn-primary"
            onClick={async () => {
              try {
                await api.createUser(form.username, form.password, form.role);
                setForm({ username: '', password: '', role: 'user' });
                await reload();
                toast(t('users.created'));
              } catch (err) {
                toast(err instanceof Error ? err.message : t('common.createFailed'));
              }
            }}
          >
            {t('users.create')}
          </button>
        </div>
      </div>

      <div className="border-t border-line pt-4">
        <h3 className="mb-2 text-[14px] font-medium">{t('users.list')}</h3>
        <div className="space-y-2">
          {users.map((u) => (
            <div key={u.id} className="flex flex-wrap items-center gap-2 rounded-xl border border-line p-2 text-[13px]">
              <Icon icon="mdi:account-outline" size={18} title={u.username} />
              <span>{u.username}</span>
              <span className="chip">
                {u.role === 'admin' ? t('home.roleAdmin') : u.role === 'guest' ? t('home.roleGuest') : t('home.roleUser')}
              </span>
              {u.id === current.id ? <span className="chip">{t('home.currentLogin')}</span> : null}

              <div className="ml-auto flex gap-1">
                {u.role !== 'guest' ? (
                  <button className="btn btn-ghost" onClick={() => setEditPw({ id: u.id, password: '' })}>
                    {t('users.resetPassword')}
                  </button>
                ) : null}
                {u.role !== 'guest' && u.id !== current.id ? (
                  <button
                    className="btn btn-ghost text-red-500"
                    onClick={async () => {
                      if (!confirm(t('users.deleteConfirm', { name: u.username }))) return;
                      await api.deleteUser(u.id);
                      await reload();
                      toast(t('common.deleted'));
                    }}
                  >
                    {t('common.delete')}
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>

      {editPw ? (
        <div className="modal-backdrop" onClick={() => setEditPw(null)}>
          <div className="modal max-w-sm" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 text-[15px] font-medium">{t('users.resetPassword')}</h3>
            <input
              className="field"
              type="password"
              placeholder={t('dialog.password.new')}
              value={editPw.password}
              onChange={(e) => setEditPw({ ...editPw, password: e.target.value })}
            />
            <div className="mt-4 flex justify-end gap-2">
              <button className="btn" onClick={() => setEditPw(null)}>
                {t('common.cancel')}
              </button>
              <button
                className="btn btn-primary"
                onClick={async () => {
                  try {
                    await api.updateUser(editPw.id, { password: editPw.password });
                    setEditPw(null);
                    toast(t('users.passwordReset'));
                  } catch (err) {
                    toast(err instanceof Error ? err.message : t('common.operationFailed'));
                  }
                }}
              >
                {t('common.save')}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ------------------------------ 系统状态 ------------------------------ */

function fmtDuration(s: number, t: (k: string, p?: Record<string, string | number>) => string): string {
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  if (d) return `${d} ${t('common.day')} ${h} ${t('common.hour')}`;
  if (h) return `${h} ${t('common.hour')} ${m} ${t('common.minute')}`;
  return `${m} ${t('common.minute')}`;
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-line/50 py-1.5 text-[13px] last:border-0">
      <span className="text-muted">{label}</span>
      <span className="text-right">{value}</span>
    </div>
  );
}

function Bar({ value, max, label, hint }: { value: number; max: number; label: string; hint: string }) {
  const pct = max > 0 ? Math.min(100, Math.round((value / max) * 100)) : 0;
  return (
    <div className="py-2">
      <div className="mb-1 flex justify-between text-[12px]">
        <span>{label}</span>
        <span className="text-muted">
          {hint} · {pct}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-line/70">
        <div className="h-2 rounded-full bg-brand" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function StatusTab() {
  const { t } = useI18n();
  const [data, setData] = useState<SystemStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api.system());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.loadFailed'));
    }
  }, [t]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 10000);
    return () => clearInterval(timer);
  }, [load]);

  if (error) return <p className="py-6 text-center text-[13px] text-red-500">{error}</p>;
  if (!data) return <p className="py-6 text-center text-[13px] text-muted">{t('common.loading')}</p>;

  const usedMem = +(data.host.totalMemGb - data.host.freeMemGb).toFixed(1);

  return (
    <div>
      <div className="mb-4 flex items-center">
        <h3 className="text-[14px] font-medium">{t('status.title')}</h3>
        <span className="chip ml-2">{t('status.autoRefresh')}</span>
        <button className="btn ml-auto" onClick={() => void load()}>
          <Icon icon="mdi:refresh" size={16} title={t('common.refresh')} />
          {t('common.refresh')}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-line p-4">
          <div className="mb-2 flex items-center gap-1.5 text-[13px] font-medium">
            <Icon icon="mdi:server-outline" size={17} title={t('status.service')} />
            {t('status.service')}
          </div>
          <Stat label={t('status.version')} value={`v${data.version}`} />
          <Stat label={t('status.uptime')} value={fmtDuration(data.service.uptime, t)} />
          <Stat label={t('status.pid')} value={String(data.service.pid)} />
          <Stat label={t('status.node')} value={data.service.nodeVersion} />
          <Stat label={t('status.memory')} value={`${data.service.rssMb} MB`} />
          <Stat label={t('status.heap')} value={`${data.service.heapUsedMb} MB`} />
        </div>

        <div className="rounded-xl border border-line p-4">
          <div className="mb-2 flex items-center gap-1.5 text-[13px] font-medium">
            <Icon icon="mdi:chip" size={17} title={t('status.host')} />
            {t('status.host')}
          </div>
          <Stat label={t('status.hostname')} value={data.host.hostname} />
          <Stat label={t('status.os')} value={`${data.host.platform} · ${data.host.arch}`} />
          <Stat label={t('status.cpu')} value={t('status.cpuCores', { n: data.host.cpuCount })} />
          <Stat label={t('status.cpuModel')} value={data.host.cpuModel} />
          <Stat label={t('status.load')} value={data.host.loadAvg.join(' / ')} />
          <Stat label={t('status.osUptime')} value={fmtDuration(data.host.osUptime, t)} />
          <Bar
            value={usedMem}
            max={data.host.totalMemGb}
            label={t('status.memUsage')}
            hint={`${usedMem} / ${data.host.totalMemGb} GB`}
          />
        </div>

        <div className="rounded-xl border border-line p-4">
          <div className="mb-2 flex items-center gap-1.5 text-[13px] font-medium">
            <Icon icon="mdi:database-outline" size={17} title={t('status.data')} />
            {t('status.data')}
          </div>
          <Stat label={t('status.groups')} value={t('status.count', { n: data.data.groups })} />
          <Stat label={t('status.items')} value={t('status.count', { n: data.data.items })} />
          <Stat label={t('status.files')} value={t('status.count', { n: data.data.files })} />
          <Stat label={t('status.accounts')} value={t('status.count', { n: data.data.users })} />
          <Stat label={t('status.database')} value={`${data.data.dbSizeMb} MB`} />
          <Stat label={t('status.dataDir')} value={data.data.dataDir} />
        </div>

        <div className="rounded-xl border border-line p-4">
          <div className="mb-2 flex items-center gap-1.5 text-[13px] font-medium">
            <Icon icon="mdi:console" size={17} title={t('status.ops')} />
            {t('status.ops')}
          </div>
          <div className="space-y-1.5 font-mono text-[12px] text-muted">
            <div>sh scripts/start.sh　{t('common.start')}</div>
            <div>sh scripts/stop.sh　{t('common.stop')}</div>
            <div>sh scripts/update.sh　{t('common.update')}</div>
            <div>sh scripts/address.sh　{t('status.address')}</div>
          </div>
          <p className="mt-2 text-[12px] text-muted">{t('status.logFile')}</p>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------ 关于 ------------------------------ */

function AboutTab() {
  const { t } = useI18n();
  return (
    <div className="space-y-3 text-[13px] leading-relaxed">
      <p className="font-medium">{t('about.version', { version: '0.1.0' })}</p>
      <p className="text-muted">{t('about.desc')}</p>
      <ul className="list-inside list-disc space-y-1 text-muted">
        <li>{t('about.featureStorage')}</li>
        <li>{t('about.featureDeploy')}</li>
        <li>{t('about.featureIcon')}</li>
        <li>{t('about.featureNext')}</li>
      </ul>
    </div>
  );
}
