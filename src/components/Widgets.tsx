'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, type DockerListResult, type MetricsResult } from '@/lib/api-client';
import { renderMarkdown } from '@/lib/markdown';
import { Icon } from './Icon';
import { Sparkline } from './Sparkline';
import { useI18n } from '@/i18n';
import type { Settings } from '@/lib/types';

interface Props {
  settings: Settings;
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

/* ----------------------------- 便签卡片 ----------------------------- */
function NotesCard({ text }: { text: string }) {
  const { t } = useI18n();
  return (
    <div className="card widget p-4">
      <WidgetHead icon="mdi:file-document-outline" title={t('widget.notes')} />
      {!text.trim() ? (
        <WidgetEmpty icon="mdi:file-document-outline" text={t('widget.notesEmpty')} />
      ) : (
        <div className="md-body text-[12px] leading-relaxed text-ink/90" dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }} />
      )}
    </div>
  );
}

/* ----------------------------- 容器 ----------------------------- */
export function Widgets({ settings }: Props) {
  const cards: React.ReactNode[] = [];
  if (settings.widgetSystem) cards.push(<SystemCard key="system" refreshSec={settings.widgetRefresh} />);
  if (settings.widgetDocker && settings.dockerEnabled) cards.push(<DockerCard key="docker" refreshSec={settings.widgetRefresh} />);
  if (settings.widgetClock) cards.push(<ClockCard key="clock" />);
  if (settings.widgetWeather) cards.push(<WeatherCard key="weather" city={settings.widgetWeatherCity} refreshSec={settings.widgetRefresh} />);
  if (settings.widgetRss) cards.push(<RssCard key="rss" feeds={settings.widgetRssFeeds} max={settings.widgetRssMax} refreshSec={settings.widgetRefresh} />);
  if (settings.widgetNotes) cards.push(<NotesCard key="notes" text={settings.widgetNotesText} />);

  if (!cards.length) return null;

  return <div className="mb-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{cards}</div>;
}
