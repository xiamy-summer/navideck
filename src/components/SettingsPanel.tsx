'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { api, type SystemStatus } from '@/lib/api-client';
import { Icon } from './Icon';
import { DockerPanel } from './DockerPanel';
import { MetricsPanel } from './MetricsPanel';
import type { Role, SearchEngine, Settings, UploadedFile, User } from '@/lib/types';
import { useI18n, LANGS, type Lang } from '@/i18n';
import { APP_VERSION } from '@/lib/version';
import { THEME_PRESETS } from '@/lib/theme';

type Tab =
  | 'appearance'
  | 'search'
  | 'custom'
  | 'data'
  | 'users'
  | 'status'
  | 'docker'
  | 'metrics'
  | 'oidc'
  | 'about';

const TABS: Array<{ id: Tab; icon: string; adminOnly?: boolean }> = [
  { id: 'appearance', icon: 'mdi:palette-outline' },
  { id: 'search', icon: 'mdi:magnify' },
  { id: 'custom', icon: 'mdi:code-braces' },
  { id: 'data', icon: 'mdi:database-outline' },
  { id: 'users', icon: 'mdi:account-multiple-outline', adminOnly: true },
  { id: 'status', icon: 'mdi:chart-box-outline' },
  { id: 'docker', icon: 'mdi:docker', adminOnly: true },
  { id: 'metrics', icon: 'mdi:chart-line' },
  { id: 'oidc', icon: 'mdi:shield-key-outline', adminOnly: true },
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

  // 「全局设置」是 OIDC / 监控告警 / 访客开关等全局配置的唯一入口，必须始终可进入，
  // 不能随多用户判断一起隐藏（否则会陷入「提示切全局、却没有全局入口」的死锁）。
  // 只精简掉真正冗余的部分：与自己重复的账号项。
  const otherRealUsers = users.filter((u) => u.role !== 'guest' && u.id !== user.id);
  const multiUser = otherRealUsers.length > 0;
  const guestUser = users.find((u) => u.role === 'guest');
  const showTargetPicker = isAdmin;

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
      // 外观设置即时同步 DOM（无需刷新）：预设/强调色 → html[data-preset] + --brand，背景 → body data-bg-mode / --bg-image
      // 仅「自己的配置」生效；全局/代管场景改动的是其他配置源，页面下次加载才呈现
      if (!isGlobal && as == null) applyAppearanceDom(saved);
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

  // 单点登录为全局设置：打开该页签时自动切到「全局设置」，
  // 免去手动切换（否则极易误存进个人设置，表现为"开了开关但登录页没按钮"）
  useEffect(() => {
    if (tab === 'oidc' && isAdmin && !isGlobal) {
      setAs(null);
      setIsGlobal(true);
      void reload(null, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, isAdmin]);

  return (
    <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6">
      <div className="mb-5 flex flex-wrap items-center gap-2">
        <button className="btn btn-ghost" onClick={() => router.push('/')}>
          <Icon icon="mdi:arrow-left" size={18} title={t('common.backHome')} />
          {t('common.backHome')}
        </button>
        <h1 className="text-[17px] font-medium">{t('settings.title')}</h1>

        {showTargetPicker ? (
          <select
            className="field ml-auto w-auto"
            value={isGlobal ? 'global' : as === null ? 'self' : String(as)}
            onChange={(e) => selectTarget(e.target.value)}
          >
            <option value="self">{t('settings.targetSelf')}</option>
            {/* 全局设置：OIDC / 告警 / 访客开关的唯一入口，始终保留 */}
            <option value="global">{t('settings.targetGlobal')}</option>
            {/* 代管其他用户只在多用户场景下才有意义 */}
            {multiUser
              ? otherRealUsers.map((u) => (
                  <option key={u.id} value={u.id}>
                    {t('users.userLabel', { name: u.username })}
                  </option>
                ))
              : null}
            {guestUser ? <option value={guestUser.id}>{t('home.editGuest')}</option> : null}
          </select>
        ) : null}
      </div>

      <div className="md:flex md:items-start md:gap-5">
        <nav className="settings-nav mb-4 md:sticky md:top-5 md:mb-0 md:w-[188px] md:flex-none">
          {TABS.filter((tabMeta) => !tabMeta.adminOnly || isAdmin).map((tabMeta) => (
            <button
              key={tabMeta.id}
              onClick={() => setTab(tabMeta.id)}
              data-active={tab === tabMeta.id}
              className="settings-nav-item"
            >
              <Icon icon={tabMeta.icon} size={17} title="" />
              {t(`tab.${tabMeta.id}`)}
            </button>
          ))}
        </nav>

        <div className="min-w-0 flex-1 space-y-4">
          {tab === 'appearance' ? (
            <AppearanceTab settings={settings} onSave={save} setLang={setLang} as={as} />
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
          {tab === 'status' ? (
            <div className="card p-5">
              <StatusTab />
            </div>
          ) : null}
          {tab === 'docker' && isAdmin ? (
            <div className="card p-5">
              <DockerPanel toast={setToast} />
            </div>
          ) : null}
          {tab === 'metrics' ? (
            <div className="card p-5">
              <MetricsPanel />
            </div>
          ) : null}
          {tab === 'oidc' && isAdmin ? <OidcTab settings={settings} onSave={save} isGlobal={isGlobal} /> : null}
          {tab === 'about' ? <AboutTab /> : null}
        </div>
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

/** 保存后把外观改动即时同步到 DOM（预设 id / --brand / body 背景），免刷新生效 */
function applyAppearanceDom(s: Settings) {
  const doc = document.documentElement;
  if (s.themePreset) {
    doc.dataset.preset = s.themePreset;
    const p = THEME_PRESETS.find((x) => x.id === s.themePreset);
    if (p) {
      const accent = s.accent && s.accent !== p.accent ? s.accent : p.accent;
      doc.style.setProperty('--brand', hexToRgbStr(accent));
    }
  }
  if (s.accent) {
    // 仅当没有明确预设时才直接按 accent 覆盖（避免 preset 切换的瞬间闪变）
    const p = THEME_PRESETS.find((x) => x.id === (s.themePreset || doc.dataset.preset));
    if (!p || s.accent !== p.accent) doc.style.setProperty('--brand', hexToRgbStr(s.accent));
  }
  document.body.dataset.bgMode = s.bgMode || 'cover';
  if (s.bgImage) document.body.style.setProperty('--bg-image', `url("${s.bgImage}")`);
  else document.body.style.removeProperty('--bg-image');
}

function hexToRgbStr(hex: string): string {
  const value = hex.replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value;
  const num = Number.parseInt(full, 16);
  if (Number.isNaN(num)) return '59 130 246';
  return `${(num >> 16) & 255} ${(num >> 8) & 255} ${num & 255}`;
}

/** 设置分组卡片：品牌竖条标题（与首页分组一致），内部行用 divide 分隔 */
function Section({
  title,
  hint,
  children,
}: {
  title: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="settings-section">
      <div className="settings-section-title">
        <span className="group-rule" aria-hidden />
        {title}
      </div>
      {hint ? <div className="settings-section-hint">{hint}</div> : null}
      <div className="mt-1 divide-y divide-line/40">{children}</div>
    </section>
  );
}

/** 纵向字段：label 在上、控件在下，适合长 URL / 全宽输入 */
function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="py-3 first:pt-3 last:pb-1">
      <div className="text-[13px]">{label}</div>
      {hint ? <div className="text-[11px] text-muted">{hint}</div> : null}
      <div className="mt-1.5">{children}</div>
    </div>
  );
}

/** 紧凑分段切换（主题 / 内外网 / 位置等 2-3 选一） */
function MiniSegment<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (v: T) => void;
}) {
  return (
    <div className="segment segment-compact">
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          className="segment-item"
          data-active={value === o.value}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

function Row({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-3 py-3">
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
  as,
}: {
  settings: Settings;
  onSave: (p: Partial<Settings>) => void;
  setLang: (lang: Lang) => void;
  as?: number | null;
}) {
  const { t } = useI18n();
  const bgInput = useRef<HTMLInputElement>(null);
  const changeLang = (next: Lang) => {
    onSave({ lang: next });
    setLang(next);
  };
  const uploadBg = async (file: File) => {
    try {
      const rec = await api.uploadFile(file, as ?? undefined);
      onSave({ bgImage: `/api/files/${rec.path}` });
    } catch {
      // 静默失败不打断输入；Toast 链路在父组件
    }
  };
  const pickRandomPreset = () => {
    const others = THEME_PRESETS.filter((p) => p.id !== settings.themePreset);
    const picked = others[Math.floor(Math.random() * others.length)] ?? THEME_PRESETS[0];
    onSave({ themePreset: picked.id, accent: picked.accent });
  };
  return (
    <div className="space-y-4">
      <Section title={t('settings.section.basic')}>
        <Row label={t('appearance.siteTitle')}>
          <input className="field w-56" value={settings.siteTitle} onChange={(e) => onSave({ siteTitle: e.target.value })} />
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
        <Row label={t('appearance.theme')} hint={t('appearance.themeHint')}>
          <MiniSegment
            value={settings.theme}
            options={[
              { value: 'auto', label: t('theme.auto') },
              { value: 'light', label: t('theme.light') },
              { value: 'dark', label: t('theme.dark') },
            ]}
            onChange={(v) => onSave({ theme: v })}
          />
        </Row>
      </Section>

      <Section title={t('settings.section.preset')}>
        <Row label={t('appearance.themePreset')} hint={t('appearance.themePresetHint')}>
          <div className="flex flex-wrap items-center gap-2">
            {THEME_PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                title={p.label}
                onClick={() => onSave({ themePreset: p.id, accent: p.accent })}
                className="h-8 w-8 rounded-full border transition"
                style={{
                  background: `linear-gradient(135deg, ${p.accent}, ${p.accent}cc)`,
                  borderColor: settings.themePreset === p.id ? 'rgb(var(--brand))' : 'rgb(var(--line))',
                  boxShadow: settings.themePreset === p.id ? '0 0 0 2px rgb(var(--brand) / .35)' : undefined,
                }}
              />
            ))}
            <button
              type="button"
              className="btn"
              onClick={pickRandomPreset}
              title={t('appearance.presetRandom')}
            >
              <Icon icon="mdi:dice-multiple" size={15} title="" />
              {t('appearance.presetRandom')}
            </button>
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
      </Section>

      <Section title={t('settings.section.layout')}>
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
      </Section>

      <Section title={t('settings.section.bg')}>
        <Row label={t('appearance.bgMode')}>
          <MiniSegment
            value={settings.bgMode}
            options={[
              { value: 'cover', label: t('appearance.bgModeCover') },
              { value: 'blur', label: t('appearance.bgModeBlur') },
            ]}
            onChange={(v) => onSave({ bgMode: v })}
          />
        </Row>
        <Row label={t('appearance.bgImage')} hint={t('appearance.bgImageHint')}>
          <input
            className="field w-64"
            placeholder="https://…/bg.jpg"
            value={settings.bgImage}
            onChange={(e) => onSave({ bgImage: e.target.value })}
          />
          <button className="btn" onClick={() => bgInput.current?.click()}>
            <Icon icon="mdi:upload" size={15} title="" />
            {t('appearance.uploadBg')}
          </button>
          {settings.bgImage ? (
            <button className="btn btn-ghost" onClick={() => onSave({ bgImage: '' })}>
              {t('appearance.clear')}
            </button>
          ) : null}
          <input
            ref={bgInput}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void uploadBg(f);
              e.target.value = '';
            }}
          />
        </Row>
      </Section>

      <Section title={t('settings.section.network')}>
        <Row label={t('appearance.netMode')}>
          <MiniSegment
            value={settings.netMode}
            options={[
              { value: 'lan', label: t('net.lan') },
              { value: 'wan', label: t('net.wan') },
            ]}
            onChange={(v) => onSave({ netMode: v })}
          />
        </Row>
        <Row label={t('appearance.guest')} hint={t('appearance.guestHint')}>
          <Switch value={settings.guestEnabled} onChange={(v) => onSave({ guestEnabled: v })} />
        </Row>
      </Section>

      <Section title={t('settings.section.widgets')}>
        <Row label={t('appearance.widgets')} hint={t('appearance.widgetsHint')}>
          <Switch value={settings.widgetsEnabled} onChange={(v) => onSave({ widgetsEnabled: v })} />
        </Row>
        <Row label={t('appearance.widgetPosition')}>
          <MiniSegment
            value={settings.widgetPosition}
            options={[
              { value: 'top', label: t('appearance.positionTop') },
              { value: 'bottom', label: t('appearance.positionBottom') },
            ]}
            onChange={(v) => onSave({ widgetPosition: v })}
          />
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
      </Section>

      <Section title={t('settings.section.widgetsExt')}>
        <Row label={t('appearance.widgetSize')} hint={t('appearance.widgetSizeHint')}>
          <MiniSegment
            value={settings.widgetSize}
            options={[
              { value: 'sm', label: t('appearance.widgetSizeSm') },
              { value: 'md', label: t('appearance.widgetSizeMd') },
              { value: 'lg', label: t('appearance.widgetSizeLg') },
            ]}
            onChange={(v) => onSave({ widgetSize: v })}
          />
        </Row>
        <Row label={t('appearance.widgetClock')}>
          <Switch value={settings.widgetClock} onChange={(v) => onSave({ widgetClock: v })} />
        </Row>
        <Row label={t('appearance.widgetWeather')}>
          <Switch value={settings.widgetWeather} onChange={(v) => onSave({ widgetWeather: v })} />
        </Row>
        <Row label={t('appearance.widgetWeatherCity')} hint={t('appearance.widgetWeatherCityHint')}>
          <input
            className="field w-48"
            placeholder={t('appearance.widgetWeatherCity')}
            value={settings.widgetWeatherCity}
            onChange={(e) => onSave({ widgetWeatherCity: e.target.value })}
          />
        </Row>
        <Row label={t('appearance.widgetRss')}>
          <Switch value={settings.widgetRss} onChange={(v) => onSave({ widgetRss: v })} />
        </Row>
        <Row label={t('appearance.widgetRssFeeds')} hint={t('appearance.widgetRssFeedsHint')}>
          <textarea
            className="field h-24 w-72 resize-y font-mono text-[12px]"
            placeholder="https://example.com/feed.xml"
            value={settings.widgetRssFeeds.join('\n')}
            onChange={(e) =>
              onSave({
                widgetRssFeeds: e.target.value
                  .split('\n')
                  .map((s) => s.trim())
                  .filter(Boolean),
              })
            }
          />
        </Row>
        <Row label={t('appearance.widgetRssMax')}>
          <Num
            value={settings.widgetRssMax}
            min={1}
            max={30}
            suffix={t('common.items')}
            onChange={(v) => onSave({ widgetRssMax: v })}
          />
        </Row>
        <Row label={t('appearance.widgetNotes')}>
          <Switch value={settings.widgetNotes} onChange={(v) => onSave({ widgetNotes: v })} />
        </Row>
        <Row label={t('appearance.widgetNotesText')} hint={t('appearance.widgetNotesTextHint')}>
          <textarea
            className="field h-28 w-72 resize-y text-[12px]"
            placeholder={"# 便签\n- 支持 **Markdown**\n- 链接 [NaviDeck](https://example.com)"}
            value={settings.widgetNotesText}
            onChange={(e) => onSave({ widgetNotesText: e.target.value })}
          />
        </Row>
      </Section>
    </div>
  );
}

/* ------------------------------ 搜索 ------------------------------ */

function SearchTab({ settings, onSave }: { settings: Settings; onSave: (p: Partial<Settings>) => void }) {
  const { t } = useI18n();
  const engines = settings.searchEngines ?? [];

  const updateEngines = (next: SearchEngine[]) => onSave({ searchEngines: next });

  return (
    <div className="space-y-4">
      <Section title={t('search.section.behavior')}>
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
      </Section>

      <Section title={t('search.engines')} hint={t('search.qTip')}>
        <div className="py-3">
          <div className="mb-3 flex items-center">
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
        </div>
      </Section>
    </div>
  );
}

/* ------------------------------ 自定义代码 ------------------------------ */

function CustomTab({ settings, onSave }: { settings: Settings; onSave: (p: Partial<Settings>) => void }) {
  const { t } = useI18n();
  return (
    <div className="space-y-4">
      <Section title={t('custom.css')}>
        <div className="py-3">
          <textarea
            className="field h-48 font-mono text-[12px]"
            placeholder={t('custom.cssPlaceholder')}
            value={settings.customCss}
            onChange={(e) => onSave({ customCss: e.target.value })}
          />
          <div className="mt-3 flex justify-end">
            <button className="btn btn-primary" onClick={() => onSave({ customCss: settings.customCss })}>
              {t('custom.apply')}
            </button>
          </div>
        </div>
      </Section>

      <Section title={t('custom.js')} hint={t('custom.tip')}>
        <div className="py-3">
          <textarea
            className="field h-48 font-mono text-[12px]"
            placeholder={t('custom.jsPlaceholder')}
            value={settings.customJs}
            onChange={(e) => onSave({ customJs: e.target.value })}
          />
          <div className="mt-3 flex justify-end">
            <button className="btn btn-primary" onClick={() => onSave({ customJs: settings.customJs })}>
              {t('custom.apply')}
            </button>
          </div>
        </div>
      </Section>
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

  const sunPanelInput = useRef<HTMLInputElement>(null);
  const [sunPanelMode, setSunPanelMode] = useState<'replace' | 'append'>('append');
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

  const doImportSunPanel = async (file: File, mode: 'replace' | 'append') => {
    try {
      const res = await api.importSunPanel(file, mode, as ?? undefined);
      const base = t('data.imported', { g: res.groupCount, i: res.itemCount });
      toast(res.iconCount ? `${base}（${t('data.sunPanelIcons', { n: res.iconCount })}）` : base);
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
    <div className="space-y-4">
      <Section title={t('data.backup')}>
        <div className="py-3">
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
      </Section>

      <Section title={t('data.bookmarks')}>
        <div className="py-3">
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
      </Section>

      <Section title={t('data.sunPanel')}>
        <div className="py-3">
          <div className="flex flex-wrap gap-2">
            <button
              className="btn"
              onClick={() => {
                setSunPanelMode('append');
                sunPanelInput.current?.click();
              }}
            >
              <Icon icon="mdi:import" size={17} title={t('data.importSunPanel')} />
              {t('data.importSunPanel')}
            </button>
            <button
              className="btn"
              onClick={() => {
                if (confirm(t('data.importConfirm'))) {
                  setSunPanelMode('replace');
                  sunPanelInput.current?.click();
                }
              }}
            >
              {t('data.sunPanelReplace')}
            </button>
          </div>
          <input
            ref={sunPanelInput}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void doImportSunPanel(file, sunPanelMode);
              e.target.value = '';
            }}
          />
          <p className="mt-2 text-[12px] text-muted">{t('data.importSunPanelTip')}</p>
        </div>
      </Section>

      <Section title={t('monitor.title')} hint={t('monitor.hint')}>
        <Row label={t('monitor.retentionDays')} hint={t('monitor.retentionDaysHint')}>
          <Num
            value={settings.metricRetentionDays}
            min={1}
            max={365}
            onChange={(v) => onSave({ metricRetentionDays: v })}
          />
        </Row>
        <Row label={t('monitor.archiveInterval')} hint={t('monitor.archiveIntervalHint')}>
          <Num
            value={settings.metricArchiveInterval}
            min={30}
            max={3600}
            onChange={(v) => onSave({ metricArchiveInterval: v })}
          />
        </Row>
        <Row label={t('monitor.alertEnabled')} hint={t('monitor.alertEnabledHint')}>
          <Switch value={settings.metricAlertEnabled} onChange={(v) => onSave({ metricAlertEnabled: v })} />
        </Row>
        <Row label={t('monitor.alertCpu')} hint={t('monitor.thresholdHint')}>
          <Num
            value={settings.metricAlertCpu}
            min={1}
            max={100}
            suffix="%"
            onChange={(v) => onSave({ metricAlertCpu: v })}
          />
        </Row>
        <Row label={t('monitor.alertMem')} hint={t('monitor.thresholdHint')}>
          <Num
            value={settings.metricAlertMem}
            min={1}
            max={100}
            suffix="%"
            onChange={(v) => onSave({ metricAlertMem: v })}
          />
        </Row>
        <Row label={t('monitor.alertDisk')} hint={t('monitor.thresholdHint')}>
          <Num
            value={settings.metricAlertDisk}
            min={1}
            max={100}
            suffix="%"
            onChange={(v) => onSave({ metricAlertDisk: v })}
          />
        </Row>
        <Row label={t('monitor.alertCooldown')} hint={t('monitor.alertCooldownHint')}>
          <Num
            value={settings.metricAlertCooldown}
            min={1}
            max={1440}
            onChange={(v) => onSave({ metricAlertCooldown: v })}
          />
        </Row>
      </Section>

      <Section title={t('data.backupManage')}>
        <div className="py-3">
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
      </Section>

      <Section title={t('data.files')} hint={t('data.fileTip')}>
        <div className="py-3">
          <div className="mb-3 flex justify-end">
            <button className="btn" onClick={() => fileInput.current?.click()}>
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
      </Section>

      <Section title={t('data.reset')}>
        <div className="py-3">
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
      </Section>
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
    <div className="space-y-4">
      <Section title={t('users.add')}>
        <div className="py-3">
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
      </Section>

      <Section title={t('users.list')}>
        <div className="py-3">
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
      </Section>

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
    <Section title="NaviDeck">
      <div className="py-3">
        <div className="flex items-center gap-3">
          <div className="icon-tile">
            <Icon icon="mdi:radar" size={26} title="NaviDeck" />
          </div>
          <div>
            <div className="flex items-center gap-2 text-[16px] font-medium">
              NaviDeck <span className="count-badge">v{APP_VERSION}</span>
            </div>
            <div className="text-[12px] text-muted">{t('about.desc')}</div>
          </div>
        </div>
        <ul className="mt-4 list-inside list-disc space-y-1 text-[13px] text-muted">
          <li>{t('about.featureStorage')}</li>
          <li>{t('about.featureDeploy')}</li>
          <li>{t('about.featureIcon')}</li>
          <li>{t('about.featureNext')}</li>
        </ul>
      </div>
    </Section>
  );
}

/** 与 api/settings 的 SECRET_MASK 保持一致：收到它就代表密钥已保存 */
const OIDC_SECRET_MASK = '__set__';

function OidcTab({
  settings,
  onSave,
  isGlobal,
}: {
  settings: Settings;
  onSave: (p: Partial<Settings>) => void;
  isGlobal: boolean;
}) {
  const { t } = useI18n();
  const [secret, setSecret] = useState('');
  const [callback, setCallback] = useState('/api/auth/oidc/callback');
  const secretSaved = settings.oidcClientSecret === OIDC_SECRET_MASK;

  // 与 lib/oidc.ts 的 getOidcConfig() 判定保持一致，提前告诉用户为什么登录页没出现按钮
  const missingBasics = !settings.oidcIssuer || !settings.oidcClientId;
  const warning = !isGlobal
    ? t('oidc.warnNotGlobal')
    : settings.oidcEnabled && missingBasics
      ? t('oidc.warnIncomplete')
      : '';

  useEffect(() => {
    setCallback(`${window.location.origin}/api/auth/oidc/callback`);
  }, []);

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    ok: boolean;
    message: string;
    warning?: string;
  } | null>(null);

  const runTest = async () => {
    setTesting(true);
    setTestResult(null);
    try {
      const r = await api.oidcTest();
      setTestResult({ ok: r.ok, message: r.message, warning: r.warning });
    } catch (e) {
      setTestResult({ ok: false, message: e instanceof Error ? e.message : t('oidc.testFailed') });
    } finally {
      setTesting(false);
    }
  };

  return (
    <div className="space-y-4">
      {warning ? (
        <div className="flex items-start gap-2 rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-[12px] text-amber-700 dark:text-amber-300">
          <Icon icon="mdi:alert-outline" size={16} title={t('common.hint')} />
          <span>{warning}</span>
        </div>
      ) : null}

      <div className="rounded-xl border border-line p-3 text-[12px] text-muted">
        <span>{t('oidc.callbackHint')}</span>
        <code className="ml-1 break-all text-[12px]">{callback}</code>
      </div>

      <Section title={t('oidc.section.connection')}>
        <Row label={t('oidc.enabled')} hint={t('oidc.enabledHint')}>
          <Switch value={settings.oidcEnabled} onChange={(v) => onSave({ oidcEnabled: v })} />
        </Row>

        <Field label={t('oidc.issuer')} hint={t('oidc.issuerHint')}>
          <input
            className="field w-full"
            placeholder="https://auth.example.com"
            value={settings.oidcIssuer}
            onChange={(e) => onSave({ oidcIssuer: e.target.value.trim() })}
          />
        </Field>

        <Field label={t('oidc.clientId')} hint={t('oidc.clientIdHint')}>
          <input
            className="field w-full"
            value={settings.oidcClientId}
            onChange={(e) => onSave({ oidcClientId: e.target.value.trim() })}
          />
        </Field>

        <Field
          label={t('oidc.clientSecret')}
          hint={secretSaved ? t('oidc.secretSaved') : t('oidc.secretHint')}
        >
          <div className="relative">
            <input
              className="field w-full pr-16"
              type="password"
              autoComplete="off"
              placeholder={secretSaved ? t('oidc.secretSaved') : t('oidc.secretHint')}
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              onBlur={() => {
                if (secret.trim()) onSave({ oidcClientSecret: secret.trim() });
                setSecret('');
              }}
            />
            {/* 密钥不回显是安全设计，用徽章明确「已配置」，避免被误认为保存失败 */}
            {secretSaved && !secret ? (
              <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] text-emerald-600 dark:text-emerald-400">
                {t('oidc.secretConfigured')}
              </span>
            ) : null}
          </div>
        </Field>

        <Field label={t('oidc.redirectUri')} hint={t('oidc.redirectUriHint')}>
          <input
            className="field w-full"
            placeholder={callback}
            value={settings.oidcRedirectUri}
            onChange={(e) => onSave({ oidcRedirectUri: e.target.value.trim() })}
          />
        </Field>

        <Field label={t('oidc.scopes')} hint={t('oidc.scopesHint')}>
          <input
            className="field w-full"
            value={settings.oidcScopes}
            onChange={(e) => onSave({ oidcScopes: e.target.value })}
          />
        </Field>

        <Row label={t('oidc.defaultRole')} hint={t('oidc.defaultRoleHint')}>
          <select
            className="field w-40"
            value={settings.oidcDefaultRole || 'user'}
            onChange={(e) => onSave({ oidcDefaultRole: e.target.value })}
          >
            <option value="user">{t('oidc.roleUser')}</option>
            <option value="admin">{t('oidc.roleAdmin')}</option>
          </select>
        </Row>

        <Field label={t('oidc.buttonLabel')} hint={t('oidc.buttonLabelHint')}>
          <input
            className="field w-full"
            placeholder={t('login.sso')}
            value={settings.oidcButtonLabel}
            onChange={(e) => onSave({ oidcButtonLabel: e.target.value })}
          />
        </Field>
      </Section>

      <Section title={t('oidc.section.adminRule')} hint={t('oidc.adminRuleHint')}>
        <Field label={t('oidc.adminClaim')} hint={t('oidc.adminClaimHint')}>
          <input
            className="field w-full"
            placeholder="groups"
            value={settings.oidcAdminClaim}
            onChange={(e) => onSave({ oidcAdminClaim: e.target.value.trim() })}
          />
        </Field>
        <Field label={t('oidc.adminValue')} hint={t('oidc.adminValueHint')}>
          <input
            className="field w-full"
            placeholder="navideck-admins"
            value={settings.oidcAdminValue}
            onChange={(e) => onSave({ oidcAdminValue: e.target.value.trim() })}
          />
        </Field>
      </Section>

      {/* 自助诊断：点一下就知道能不能拉到 IdP 元数据，不用靠报错猜 */}
      <Section title={t('oidc.section.diagnostics')} hint={t('oidc.testHint')}>
        <div className="py-3">
          <button className="btn" onClick={runTest} disabled={testing}>
            <Icon icon="mdi:lan-connect" size={16} title={t('oidc.test')} />
            {testing ? t('oidc.testing') : t('oidc.test')}
          </button>

          {testResult ? (
            <div
              className={`mt-2 flex items-start gap-2 rounded-xl border px-3 py-2 text-[12px] ${
                testResult.ok
                  ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400'
                  : 'border-red-500/40 bg-red-500/10 text-red-600 dark:text-red-400'
              }`}
            >
              <Icon
                icon={testResult.ok ? 'mdi:check-circle-outline' : 'mdi:alert-circle-outline'}
                size={16}
                title={t('oidc.test')}
              />
              <div className="min-w-0 flex-1">
                <div className="break-all">{testResult.message}</div>
                {testResult.warning ? <div className="mt-1 break-all">{testResult.warning}</div> : null}
              </div>
            </div>
          ) : null}
        </div>
      </Section>
    </div>
  );
}
