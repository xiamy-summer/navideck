'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { api, type DockerListResult, type MetricsResult } from '@/lib/api-client';
import { renderMarkdown } from '@/lib/markdown';
import { Icon } from './Icon';
import { Sparkline } from './Sparkline';
import { useI18n } from '@/i18n';
import type { Settings } from '@/lib/types';

interface Props {
  settings: Settings;
  /** 便签保存回调（首页直接编辑用）；不传则便签为只读 */
  onSaveNotes?: (text: string) => Promise<void> | void;
  /** 单个小组件尺寸调整回调；不传则不显示尺寸入口 */
  onSaveWidgetSize?: (key: string, size: 'sm' | 'md' | 'lg') => Promise<void> | void;
}

function fmtRate(bytes: number): string {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB/s`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB/s`;
  return `${bytes} B/s`;
}

function fmtUptime(sec: number, t: (k: string, p?: Record<string, string | number>) => string): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d) return `${d} ${t('common.day')} ${h} ${t('common.hour')}`;
  if (h) return `${h} ${t('common.hour')} ${m} ${t('common.minute')}`;
  return `${m} ${t('common.minute')}`;
}

function relTime(ms: number, t: (k: string, p?: Record<string, string | number>) => string): string {
  if (!ms) return '';
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60000);
  if (min < 1) return t('common.justNow');
  if (min < 60) return t('common.minutesAgo', { n: min });
  const hr = Math.floor(min / 60);
  if (hr < 24) return t('common.hoursAgo', { n: hr });
  const day = Math.floor(hr / 24);
  return t('common.daysAgo', { n: day });
}

/** 用量配色：≥90 危险、≥75 警告、其余正常 */
function toneOf(pct: number): 'ok' | 'warn' | 'err' {
  if (pct >= 90) return 'err';
  if (pct >= 75) return 'warn';
  return 'ok';
}
const TONE_COLOR: Record<'ok' | 'warn' | 'err', string> = {
  ok: '#10b981',
  warn: '#f59e0b',
  err: '#ef4444',
};

/** 小组件统一头部：图标色块 + 标题 + 右侧副信息 */
function WidgetHead({ icon, title, children }: { icon: string; title: string; children?: React.ReactNode }) {
  return (
    <div className="widget-head">
      <span className="widget-head-icon">
        <Icon icon={icon} size={15} title={title} />
      </span>
      <span className="widget-title">{title}</span>
      {children}
    </div>
  );
}

/** 统一空态 / 加载态：图标块 + 说明文案 */
function WidgetEmpty({ icon, title, text, spin }: { icon: string; title?: string; text: string; spin?: boolean }) {
  return (
    <div className="widget-empty">
      <span className="widget-empty-icon">
        <Icon icon={icon} size={20} title={title || text} className={spin ? 'animate-spin' : undefined} />
      </span>
      {title ? <p className="text-[12.5px] font-medium">{title}</p> : null}
      <p className="widget-empty-text max-w-[210px]">{text}</p>
    </div>
  );
}

/** 加载态（与其他空态保持同一视觉语言） */
function WidgetLoading() {
  const { t } = useI18n();
  return <WidgetEmpty icon="mdi:refresh" text={t('common.loading')} spin />;
}

/* ----------------------------- 系统卡片 ----------------------------- */
function SystemCard({ refreshSec }: { refreshSec: number }) {
  const { t } = useI18n();
  const [metrics, setMetrics] = useState<MetricsResult | null>(null);
  const [unack, setUnack] = useState(0);
  const load = useCallback(async () => {
    try {
      setMetrics(await api.metrics());
    } catch {
      /* 忽略 */
    }
  }, []);
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), Math.max(5, refreshSec) * 1000);
    return () => clearInterval(timer);
  }, [load, refreshSec]);

  // 未确认告警数，仅用于卡片角标，60 秒轮询一次
  useEffect(() => {
    let alive = true;
    const loadAlerts = async () => {
      try {
        const r = await api.metricsAlerts(1, true);
        if (alive) setUnack(r.unack);
      } catch {
        /* 忽略轮询失败 */
      }
    };
    void loadAlerts();
    const timer = setInterval(() => void loadAlerts(), 60_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  const cpuHistory = metrics?.history.map((p) => p.cpu) ?? [];
  const memHistory = metrics?.history.map((p) => p.mem) ?? [];
  const cpu = metrics?.current.cpu ?? 0;
  const mem = metrics?.current.mem ?? 0;
  const diskPct = Math.min(100, metrics?.disk.usedPercent ?? 0);
  const memColor = TONE_COLOR[toneOf(mem)];
  const diskTone = toneOf(diskPct);
  const cpuTone = toneOf(cpu);
  const diskHard = metrics ? `${metrics.disk.usedGb} / ${metrics.disk.totalGb} GB` : '—';

  return (
    <div className="card widget p-4">
      <WidgetHead icon="mdi:memory" title={t('widget.system')}>
        {unack > 0 ? (
          <span className="chip ml-1 inline-flex items-center gap-1 !border-red-500/40 !py-0.5 !text-red-500">
            <Icon icon="mdi:alert-outline" size={12} title={t('metrics.alerts')} />
            {unack}
          </span>
        ) : null}
        <span className="widget-sub">{metrics ? t('widget.load', { n: metrics.cpu.loadAvg[0] }) : t('common.loading')}</span>
      </WidgetHead>

      <div className="widget-metric">
        <span className="widget-metric-label">{t('widget.cpu')}</span>
        <Sparkline bare data={cpuHistory} color={cpuTone === 'ok' ? 'rgb(var(--brand))' : TONE_COLOR[cpuTone]} />
        <span className="widget-metric-val">
          {cpu.toFixed(1)}
          <span className="widget-metric-unit">%</span>
        </span>
      </div>
      <div className="widget-metric">
        <span className="widget-metric-label">{t('widget.memory')}</span>
        <Sparkline bare data={memHistory} color={memColor} />
        <span className="widget-metric-val" style={{ color: memColor }}>
          {mem.toFixed(1)}
          <span className="widget-metric-unit">%</span>
        </span>
      </div>

      <div className="mt-3.5">
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="widget-foot-item text-[11px] text-muted">
            <Icon icon="mdi:harddisk" size={12} title={t('widget.diskLabel')} />
            {t('widget.diskLabel')}
          </span>
          <span className="text-[11px] text-muted">
            {diskHard}
            <b className="ml-1.5 font-semibold text-ink">{diskPct}%</b>
          </span>
        </div>
        <div className="widget-bar" data-tone={diskTone}>
          <i style={{ width: `${diskPct}%` }} />
        </div>
      </div>

      <div className="widget-foot">
        <span className="widget-foot-item text-emerald-600 dark:text-emerald-400">
          <Icon icon="mdi:download" size={12} title="↓" />
          {fmtRate(metrics?.current.netRx ?? 0)}
        </span>
        <span className="widget-foot-item text-sky-600 dark:text-sky-400">
          <Icon icon="mdi:upload" size={12} title="↑" />
          {fmtRate(metrics?.current.netTx ?? 0)}
        </span>
        <span className="widget-foot-item">
          <Icon icon="mdi:clock-outline" size={12} title={t('widget.uptime')} />
          {metrics ? fmtUptime(metrics.osUptime, t) : ''}
        </span>
      </div>
    </div>
  );
}

/* ----------------------------- Docker 卡片 ----------------------------- */
function DockerCard({ refreshSec }: { refreshSec: number }) {
  const { t } = useI18n();
  const [docker, setDocker] = useState<DockerListResult | null>(null);
  const load = useCallback(async () => {
    try {
      setDocker(await api.dockerContainers());
    } catch {
      /* 忽略 */
    }
  }, []);
  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), Math.max(5, refreshSec) * 1000);
    return () => clearInterval(timer);
  }, [load, refreshSec]);

  // 首页只需要知道「有没有异常」，不铺进程清单：
  // 汇总数字 + 运行比例条，只有未运行的容器才列出名称（最多 3 个）
  const total = docker?.containers.length ?? 0;
  const running = docker?.available ? docker.containers.filter((c) => c.state === 'running').length : 0;
  const stopped = docker?.available ? docker.containers.filter((c) => c.state !== 'running') : [];
  const ratio = total ? (running / total) * 100 : 0;
  const tone = stopped.length ? 'warn' : 'ok';

  return (
    <div className="card widget p-4">
      <WidgetHead icon="simple-icons:docker" title={t('widget.containers')}>
        {docker?.available ? (
          <span className="widget-sub">
            {running} / {total}
          </span>
        ) : (
          <span className="widget-sub">{t('widget.notConnected')}</span>
        )}
      </WidgetHead>

      {!docker ? (
        <WidgetLoading />
      ) : !docker.available ? (
        <WidgetEmpty icon="simple-icons:docker" title={t('widget.notConnected')} text={t('widget.dockerNoSocket', { socket: docker.socket })} />
      ) : total === 0 ? (
        <WidgetEmpty icon="simple-icons:docker" text={t('widget.noContainers')} />
      ) : (
        <>
          <div className="flex items-end justify-between">
            <span className="widget-stat">
              <span className="widget-stat-num" style={{ color: stopped.length ? TONE_COLOR.warn : TONE_COLOR.ok }}>
                {running}
              </span>
              <span className="widget-stat-unit">
                / {total} {t('widget.runningLabel')}
              </span>
            </span>
            <span className={`${stopped.length ? 'dot-warn' : 'dot-run'} dot-pulse h-2 w-2 rounded-full`} />
          </div>
          <div className="widget-bar mt-2.5" data-tone={tone}>
            <i style={{ width: `${ratio}%` }} />
          </div>
          {stopped.length ? (
            <div className="widget-foot">
              {stopped.slice(0, 3).map((c) => (
                <span key={c.id} className="widget-foot-item text-amber-600 dark:text-amber-400">
                  <span className="dot-warn h-1.5 w-1.5 rounded-full" />
                  <span className="max-w-[110px] truncate" title={c.name}>
                    {c.name}
                  </span>
                </span>
              ))}
              {stopped.length > 3 ? <span className="widget-foot-item">{t('widget.moreContainers', { n: stopped.length - 3 })}</span> : null}
            </div>
          ) : (
            <div className="widget-foot">
              <span className="widget-foot-item">
                <Icon icon="mdi:check-circle-outline" size={12} title={t('widget.allRunning', { n: running })} />
                {t('widget.allRunning', { n: running })}
              </span>
            </div>
          )}
        </>
      )}
    </div>
  );
}

/* ----------------------------- 时钟卡片 ----------------------------- */
function ClockCard() {
  const { t } = useI18n();
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  const weekdays = t('common.weekdays').split(',');
  const hh = now ? now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '--:--';
  const ss = now ? now.toLocaleTimeString([], { second: '2-digit' }).replace(/\D/g, '').padStart(2, '0') : '--';
  return (
    <div className="card widget items-center justify-center p-4 text-center">
      <div className="widget-clock-time">
        {hh}
        <small>:{ss}</small>
      </div>
      <div className="widget-clock-date">
        <Icon icon="mdi:calendar" size={11} title={t('widget.clock')} />
        {now ? `${now.toLocaleDateString()} · ${weekdays[now.getDay()] ?? ''}` : ''}
      </div>
    </div>
  );
}

/* ----------------------------- 天气卡片 ----------------------------- */
interface WeatherData {
  location: string;
  tempC: number;
  feelsC: number;
  humidity: number;
  windKmh: number;
  isDay: boolean;
  category: string;
  icon: string;
}

function WeatherCard({ city, refreshSec }: { city: string; refreshSec: number }) {
  const { t } = useI18n();
  const [data, setData] = useState<WeatherData | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!city.trim()) {
      setErr(t('widget.weatherNoCity'));
      return;
    }
    try {
      const res = await fetch(`/api/widgets/weather?city=${encodeURIComponent(city.trim())}`);
      const json = await res.json();
      if (!res.ok) {
        setErr(json?.error || t('common.loadFailed'));
        return;
      }
      setData(json as WeatherData);
      setErr(null);
    } catch {
      setErr(t('common.loadFailed'));
    }
  }, [city, t]);
  useEffect(() => {
    void load();
    if (!city.trim()) return;
    const timer = setInterval(() => void load(), Math.max(30, refreshSec) * 1000);
    return () => clearInterval(timer);
  }, [load, refreshSec]);

  if (!data) {
    return (
      <div className="card widget p-4">
        <WidgetHead icon="mdi:thermometer" title={t('widget.weather')} />
        {err ? <WidgetEmpty icon="mdi:cloud-outline" text={err} /> : <WidgetLoading />}
      </div>
    );
  }

  return (
    <div className="card widget p-4">
      <WidgetHead icon="mdi:thermometer" title={t('widget.weather')}>
        <span className="widget-sub truncate">{data.location}</span>
      </WidgetHead>
      <div className="flex flex-1 items-center gap-3">
        <Icon icon={data.icon} size={46} title={t('widget.weather')} />
        <div className="min-w-0">
          <div className="flex items-baseline gap-2">
            <span className="text-[28px] font-semibold leading-none tracking-tight">{data.tempC}°</span>
            <span className="text-[12px] text-muted">{t(`widget.weather.${data.category}`)}</span>
          </div>
          <div className="widget-foot !mt-2 !border-0 !pt-0">
            <span>{t('widget.feels')} {data.feelsC}°</span>
            <span>{t('widget.humidity')} {data.humidity}%</span>
            <span>{data.windKmh} km/h</span>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ----------------------------- RSS 卡片 ----------------------------- */
interface RssItem {
  title: string;
  link: string;
  date: number;
  source: string;
}

function RssCard({ feeds, max, refreshSec }: { feeds: string[]; max: number; refreshSec: number }) {
  const { t } = useI18n();
  const [items, setItems] = useState<RssItem[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!feeds.length) {
      setErr(t('widget.rssNoFeed'));
      return;
    }
    try {
      const res = await fetch('/api/widgets/rss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ feeds, max }),
      });
      const json = await res.json();
      if (!res.ok) {
        setErr(json?.error || t('common.loadFailed'));
        return;
      }
      setItems(json.items as RssItem[]);
      setErr(null);
    } catch {
      setErr(t('common.loadFailed'));
    }
  }, [feeds, max, t]);
  useEffect(() => {
    void load();
    if (!feeds.length) return;
    const timer = setInterval(() => void load(), Math.max(60, refreshSec * 6) * 1000);
    return () => clearInterval(timer);
  }, [load, refreshSec]);

  return (
    <div className="card widget p-4">
      <WidgetHead icon="simple-icons:rss" title={t('widget.rss')}>
        {items.length ? <span className="widget-sub">{items.length}</span> : null}
      </WidgetHead>
      {!feeds.length ? (
        <WidgetEmpty icon="simple-icons:rss" text={t('widget.rssNoFeed')} />
      ) : err && !items.length ? (
        <WidgetEmpty icon="mdi:cloud-outline" text={err} />
      ) : items.length === 0 ? (
        <WidgetLoading />
      ) : (
        <ul className="-my-1">
          {items.map((it, i) => (
            <li key={`${it.link}-${i}`}>
              <a
                href={it.link}
                target="_blank"
                rel="noopener noreferrer"
                className="group/rss flex items-start gap-2 py-1.5"
                title={it.title}
              >
                <span className="mt-[6px] h-1.5 w-1.5 flex-none rounded-full bg-brand/35 transition-colors group-hover/rss:bg-brand" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] leading-snug transition-colors group-hover/rss:text-brand">
                    {it.title}
                  </span>
                  <span className="mt-0.5 flex gap-2 text-[10px] text-muted">
                    <span className="truncate">{it.source}</span>
                    <span className="ml-auto flex-none">{relTime(it.date, t)}</span>
                  </span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

/* ----------------------------- 便签卡片（弹窗编辑） ----------------------------- */
function NotesCard({ text, onSave }: { text: string; onSave?: (text: string) => Promise<void> | void }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(text);
  const [saving, setSaving] = useState(false);
  const areaRef = useRef<HTMLTextAreaElement | null>(null);

  // 打开弹窗时同步最新内容并聚焦
  useEffect(() => {
    if (open) {
      setDraft(text);
      setTimeout(() => areaRef.current?.focus(), 60);
    }
  }, [open, text]);

  const commit = async () => {
    if (!onSave || saving) return;
    setSaving(true);
    try {
      await onSave(draft);
      setOpen(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="card widget p-4">
      <WidgetHead icon="mdi:file-document-outline" title={t('widget.notes')}>
        {onSave ? (
          <button className="widget-head-btn" onClick={() => setOpen(true)} title={t('widget.notesEdit')}>
            <Icon icon="mdi:pencil-outline" size={14} title={t('widget.notesEdit')} />
          </button>
        ) : null}
      </WidgetHead>

      {!text.trim() ? (
        <button
          type="button"
          className="widget-empty w-full"
          data-clickable={onSave ? '' : undefined}
          disabled={!onSave}
          onClick={() => {
            if (onSave) setOpen(true);
          }}
        >
          <span className="widget-empty-icon">
            <Icon icon="mdi:file-document-outline" size={20} title={t('widget.notes')} />
          </span>
          <p className="widget-empty-text max-w-[210px]">{t('widget.notesEmpty')}</p>
        </button>
      ) : (
        <div
          className="md-body text-[12px] leading-relaxed text-ink/90"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }}
        />
      )}

      {open ? (
        <div className="modal-backdrop" onClick={() => !saving && setOpen(false)}>
          <div className="modal w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
            <h3 className="mb-3 flex items-center gap-2 text-[15px] font-medium">
              <span className="icon-tile h-7 w-7 !rounded-lg !p-0">
                <Icon icon="mdi:file-document-outline" size={15} title={t('widget.notes')} />
              </span>
              {t('widget.notesEdit')}
            </h3>
            <textarea
              ref={areaRef}
              className="field widget-notes-area"
              placeholder={t('widget.notesPlaceholder')}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Escape' && !saving) {
                  e.preventDefault();
                  setOpen(false);
                } else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault();
                  void commit();
                }
              }}
            />
            <div className="mt-4 flex items-center justify-between">
              <span className="text-[11px] text-muted">{t('widget.notesPlaceholderHint')}</span>
              <span className="flex gap-2">
                <button className="btn" onClick={() => setOpen(false)} disabled={saving}>
                  {t('common.cancel')}
                </button>
                <button className="btn btn-primary" onClick={() => void commit()} disabled={saving}>
                  {saving ? t('common.saving') : t('common.save')}
                </button>
              </span>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

/* ----------------------------- 容器：瀑布流 + 单卡尺寸 ----------------------------- */

type WidgetSize = 'sm' | 'md' | 'lg';
const SIZE_ORDER: readonly WidgetSize[] = ['sm', 'md', 'lg'] as const;

/**
 * 尺寸示意图（内联 SVG，不依赖图标包）：外框表示卡片，
 * 填充块的宽度表示该档位占的列宽，离线/未打包也不会有降级文字。
 */
function SizeGlyph({ size }: { size: WidgetSize }) {
  const barW = size === 'sm' ? 6 : size === 'md' ? 10 : 17;
  const barH = size === 'sm' ? 5 : size === 'md' ? 7 : 7;
  const barY = (13 - barH) / 2;
  return (
    <svg width="21" height="13" viewBox="0 0 21 13" aria-hidden="true" className="flex-none">
      <rect x="0.5" y="0.5" width="20" height="12" rx="3" fill="none" stroke="currentColor" strokeOpacity="0.35" />
      <rect x="2" y={barY} width={barW} height={barH} rx="1.5" fill="currentColor" />
    </svg>
  );
}

function GridItem({
  itemKey,
  size,
  span,
  onChangeSize,
  labelOf,
  sizeTitle,
  open,
  onToggle,
  children,
}: {
  itemKey: string;
  size: WidgetSize;
  span: number;
  onChangeSize?: (key: string, size: WidgetSize) => void;
  labelOf: (s: WidgetSize) => string;
  sizeTitle: string;
  open: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      data-wkey={itemKey}
      data-wsize={size}
      style={{ gridRow: `span ${span}` }}
      className={`group/w relative ${size === 'lg' ? 'sm:col-span-2' : ''}`}
    >
      {children}
      {onChangeSize ? (
        <div className="absolute right-1.5 top-1.5 z-20 flex flex-col items-end" data-wmenu>
          <button
            type="button"
            className={`widget-head-btn ${open ? '' : 'opacity-0 group-hover/w:opacity-100 focus-visible:opacity-100'}`}
            onClick={(e) => {
              e.stopPropagation();
              onToggle();
            }}
            title={sizeTitle}
          >
            <Icon icon="mdi:view-dashboard-outline" size={14} title={sizeTitle} />
          </button>
          {open ? (
            <div className="widget-size-menu">
              {SIZE_ORDER.map((s) => (
                <button
                  key={s}
                  type="button"
                  className="widget-size-item"
                  data-active={size === s}
                  onClick={(e) => {
                    e.stopPropagation();
                    onChangeSize(itemKey, s);
                    onToggle(); // 选完立即收起菜单
                  }}
                >
                  <SizeGlyph size={s} />
                  {labelOf(s)}
                  {size === s ? <Icon icon="mdi:check" size={13} className="ml-auto" title={labelOf(s)} /> : null}
                </button>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * 瀑布流布局：细粒度行（8px）+ 实测卡片高度换算 span，
 * 让每张卡按自身内容高度错落排列，而不是被同一行最高的卡拉伸。
 */
function WidgetGrid({
  items,
  sizeOf,
  onChangeSize,
  labelOf,
  sizeTitle,
}: {
  items: Array<{ key: string; node: React.ReactNode }>;
  sizeOf: (key: string) => WidgetSize;
  onChangeSize?: (key: string, size: WidgetSize) => void;
  labelOf: (s: WidgetSize) => string;
  sizeTitle: string;
}) {
  const gridRef = useRef<HTMLDivElement | null>(null);
  const [spans, setSpans] = useState<Record<string, number>>({});
  const [openKey, setOpenKey] = useState<string | null>(null);
  const layoutKey = items.map((i) => `${i.key}:${sizeOf(i.key)}`).join('|');

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid) return;
    const ROW = 8;
    const GAP = 12;
    const measure = () => {
      const next: Record<string, number> = {};
      grid.querySelectorAll<HTMLElement>('[data-wkey]').forEach((box) => {
        const inner = box.firstElementChild as HTMLElement | null;
        if (!inner) return;
        const h = inner.getBoundingClientRect().height;
        next[box.dataset.wkey as string] = Math.max(1, Math.ceil((h + GAP) / (ROW + GAP)));
      });
      setSpans((prev) => {
        const keys = Object.keys(next);
        if (keys.length === Object.keys(prev).length && keys.every((k) => prev[k] === next[k])) return prev;
        return next;
      });
    };
    measure();
    const ro = new ResizeObserver(measure);
    grid.querySelectorAll<HTMLElement>('[data-wkey]').forEach((box) => {
      const inner = box.firstElementChild;
      if (inner) ro.observe(inner);
    });
    return () => ro.disconnect();
  }, [layoutKey]);

  // 点空白处关闭尺寸菜单
  useEffect(() => {
    if (!openKey) return;
    const close = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('[data-wmenu]')) setOpenKey(null);
    };
    document.addEventListener('click', close);
    return () => document.removeEventListener('click', close);
  }, [openKey]);

  return (
    <div ref={gridRef} className="widget-grid mb-5">
      {items.map(({ key, node }) => (
        <GridItem
          key={key}
          itemKey={key}
          size={sizeOf(key)}
          span={spans[key] ?? 1}
          onChangeSize={onChangeSize}
          labelOf={labelOf}
          sizeTitle={sizeTitle}
          open={openKey === key}
          onToggle={() => setOpenKey(openKey === key ? null : key)}
        >
          {node}
        </GridItem>
      ))}
    </div>
  );
}

export function Widgets({ settings, onSaveNotes, onSaveWidgetSize }: Props) {
  const { t } = useI18n();
  const items: Array<{ key: string; node: React.ReactNode }> = [];
  if (settings.widgetSystem) items.push({ key: 'system', node: <SystemCard refreshSec={settings.widgetRefresh} /> });
  if (settings.widgetDocker && settings.dockerEnabled) items.push({ key: 'docker', node: <DockerCard refreshSec={settings.widgetRefresh} /> });
  if (settings.widgetClock) items.push({ key: 'clock', node: <ClockCard /> });
  if (settings.widgetWeather) items.push({ key: 'weather', node: <WeatherCard city={settings.widgetWeatherCity} refreshSec={settings.widgetRefresh} /> });
  if (settings.widgetRss) items.push({ key: 'rss', node: <RssCard feeds={settings.widgetRssFeeds} max={settings.widgetRssMax} refreshSec={settings.widgetRefresh} /> });
  if (settings.widgetNotes) items.push({ key: 'notes', node: <NotesCard text={settings.widgetNotesText} onSave={onSaveNotes} /> });

  if (!items.length) return null;

  const fallback = settings.widgetSize ?? 'md';
  const sizeOf = (key: string): WidgetSize => settings.widgetSizes?.[key] ?? fallback;
  const labelOf = (s: WidgetSize) =>
    t(s === 'sm' ? 'appearance.widgetSizeSm' : s === 'md' ? 'appearance.widgetSizeMd' : 'appearance.widgetSizeLg');

  return (
    <WidgetGrid
      items={items}
      sizeOf={sizeOf}
      onChangeSize={onSaveWidgetSize}
      labelOf={labelOf}
      sizeTitle={t('widget.adjustSize')}
    />
  );
}
