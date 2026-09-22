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

/* ----------------------------- 系统卡片 ----------------------------- */
function SystemCard({ refreshSec }: { refreshSec: number }) {
  const { t } = useI18n();
  const [metrics, setMetrics] = useState<MetricsResult | null>(null);
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
  const cpuHistory = metrics?.history.map((p) => p.cpu) ?? [];
  const memHistory = metrics?.history.map((p) => p.mem) ?? [];
  return (
    <div className="card p-4">
      <div className="mb-2 flex items-center gap-1.5">
        <Icon icon="mdi:chip" size={17} title={t('widget.system')} />
        <span className="text-[13px] font-medium">{t('widget.system')}</span>
        <span className="ml-auto text-[11px] text-muted">
          {metrics ? t('widget.load', { n: metrics.cpu.loadAvg[0] }) : t('common.loading')}
        </span>
      </div>
      <Sparkline data={cpuHistory} label={t('metrics.cpu')} value={metrics?.current.cpu} />
      <div className="mt-1">
        <Sparkline data={memHistory} label={t('metrics.memory')} value={metrics?.current.mem} color="#10b981" />
      </div>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
        <span>{t('widget.disk', { n: metrics?.disk.usedPercent ?? 0 })}</span>
        <span>{metrics ? `${metrics.disk.usedGb} / ${metrics.disk.totalGb} GB` : ''}</span>
        <span>↓ {fmtRate(metrics?.current.netRx ?? 0)}</span>
        <span>↑ {fmtRate(metrics?.current.netTx ?? 0)}</span>
        <span>
          {t('widget.uptime')} {metrics ? fmtUptime(metrics.osUptime, t) : ''}
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
  return (
    <div className="card p-4">
      <div className="mb-2 flex items-center gap-1.5">
        <Icon icon="mdi:docker" size={17} title="Docker" />
        <span className="text-[13px] font-medium">{t('widget.containers')}</span>
        {docker?.available ? (
          <span className="ml-auto text-[11px] text-muted">
            {t('widget.running', { r: docker.containers.filter((c) => c.state === 'running').length, t: docker.containers.length })}
          </span>
        ) : (
          <span className="ml-auto text-[11px] text-muted">{t('widget.notConnected')}</span>
        )}
      </div>
      {!docker ? (
        <p className="py-4 text-[12px] text-muted">{t('common.loading')}</p>
      ) : !docker.available ? (
        <p className="py-2 text-[12px] text-muted">{t('widget.dockerNoSocket', { socket: docker.socket })}</p>
      ) : docker.containers.length === 0 ? (
        <p className="py-4 text-[12px] text-muted">{t('widget.noContainers')}</p>
      ) : (
        <div className="space-y-1">
          {docker.containers.slice(0, 5).map((c) => (
            <div key={c.id} className="flex items-center gap-2 text-[12px]">
              <span className="h-2 w-2 flex-none rounded-full" style={{ background: c.state === 'running' ? '#22c55e' : '#94a3b8' }} />
              <span className="truncate">{c.name}</span>
              <span className="ml-auto flex-none text-[11px] text-muted">{c.status}</span>
            </div>
          ))}
          {docker.containers.length > 5 ? (
            <div className="text-[11px] text-muted">{t('widget.moreContainers', { n: docker.containers.length - 5 })}</div>
          ) : null}
        </div>
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
  return (
    <div className="card flex flex-col items-center justify-center p-4">
      <Icon icon="mdi:clock-outline" size={18} title={t('widget.clock')} className="mb-1 opacity-70" />
      <div className="text-[26px] font-semibold tabular-nums leading-none">
        {now ? now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }) : '--:--:--'}
      </div>
      <div className="mt-1 text-[12px] text-muted">
        {now
          ? `${now.toLocaleDateString()} · ${weekdays[now.getDay()] ?? ''}`
          : ''}
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
  if (!city.trim()) {
    return (
      <div className="card flex flex-col items-center justify-center p-4">
        <Icon icon="mdi:weather-cloudy" size={22} title={t('widget.weather')} className="mb-1 opacity-70" />
        <p className="text-[12px] text-muted">{t('widget.weatherNoCity')}</p>
      </div>
    );
  }
  if (err && !data) {
    return (
      <div className="card flex flex-col items-center justify-center p-4">
        <Icon icon="mdi:weather-cloudy-alert" size={22} title={t('widget.weather')} className="mb-1 opacity-70" />
        <p className="text-[12px] text-muted">{err}</p>
      </div>
    );
  }
  return (
    <div className="card flex items-center gap-3 p-4">
      {data ? (
        <>
          <Icon icon={data.icon} size={40} title={t('widget.weather')} />
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-[24px] font-semibold leading-none">{data.tempC}°</span>
              <span className="text-[12px] text-muted">{t(`widget.weather.${data.category}`)}</span>
            </div>
            <div className="mt-1 truncate text-[11px] text-muted">{data.location}</div>
            <div className="mt-0.5 text-[11px] text-muted">
              {t('widget.feels')} {data.feelsC}° · {t('widget.humidity')} {data.humidity}% · {data.windKmh} km/h
            </div>
          </div>
        </>
      ) : (
        <p className="text-[12px] text-muted">{t('common.loading')}</p>
      )}
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
  if (!feeds.length) {
    return (
      <div className="card flex flex-col items-center justify-center p-4">
        <Icon icon="mdi:rss" size={22} title={t('widget.rss')} className="mb-1 opacity-70" />
        <p className="text-[12px] text-muted">{t('widget.rssNoFeed')}</p>
      </div>
    );
  }
  return (
    <div className="card p-4">
      <div className="mb-2 flex items-center gap-1.5">
        <Icon icon="mdi:rss" size={17} title={t('widget.rss')} />
        <span className="text-[13px] font-medium">{t('widget.rss')}</span>
      </div>
      {err && !items.length ? (
        <p className="py-2 text-[12px] text-muted">{err}</p>
      ) : items.length === 0 ? (
        <p className="py-2 text-[12px] text-muted">{t('common.loading')}</p>
      ) : (
        <ul className="space-y-1.5">
          {items.map((it, i) => (
            <li key={`${it.link}-${i}`} className="text-[12px]">
              <a href={it.link} target="_blank" rel="noopener noreferrer" className="block truncate hover:text-brand" title={it.title}>
                {it.title}
              </a>
              <div className="flex gap-2 text-[10px] text-muted">
                <span className="truncate">{it.source}</span>
                <span className="ml-auto flex-none">{relTime(it.date, t)}</span>
              </div>
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
  if (!text.trim()) {
    return (
      <div className="card flex flex-col items-center justify-center p-4">
        <Icon icon="mdi:note-text-outline" size={22} title={t('widget.notes')} className="mb-1 opacity-70" />
        <p className="text-[12px] text-muted">{t('widget.notesEmpty')}</p>
      </div>
    );
  }
  return (
    <div className="card p-4">
      <div className="mb-2 flex items-center gap-1.5">
        <Icon icon="mdi:note-text-outline" size={17} title={t('widget.notes')} />
        <span className="text-[13px] font-medium">{t('widget.notes')}</span>
      </div>
      <div className="md-body text-[12px] leading-relaxed text-ink/90" dangerouslySetInnerHTML={{ __html: renderMarkdown(text) }} />
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
