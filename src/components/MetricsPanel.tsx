'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, type MetricAlert, type MetricsHistoryResult, type MetricsResult } from '@/lib/api-client';
import { Icon } from './Icon';
import { Sparkline } from './Sparkline';
import { useI18n } from '@/i18n';

type RangeKey = 'live' | '1h' | '24h' | '7d';

function fmtRate(bytes: number): string {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(2)} MB/s`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB/s`;
  return `${bytes} B/s`;
}

function fmtTime(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function MetricsPanel() {
  const { t } = useI18n();
  const [data, setData] = useState<MetricsResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [range, setRange] = useState<RangeKey>('live');
  const [hist, setHist] = useState<MetricsHistoryResult | null>(null);
  const [alerts, setAlerts] = useState<{ items: MetricAlert[]; unack: number }>({ items: [], unack: 0 });

  const load = useCallback(async () => {
    try {
      setData(await api.metrics());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.loadFailed'));
    }
  }, [t]);

  const loadHist = useCallback(async () => {
    if (range === 'live') {
      setHist(null);
      return;
    }
    try {
      setHist(await api.metricsHistory(range));
    } catch {
      setHist(null);
    }
  }, [range]);

  const loadAlerts = useCallback(async () => {
    try {
      setAlerts(await api.metricsAlerts(30));
    } catch {
      /* 告警加载失败不打断监控面板 */
    }
  }, []);

  const ack = useCallback(
    async (id?: number) => {
      try {
        await api.ackAlert(id);
        await loadAlerts();
      } catch {
        /* 忽略确认失败 */
      }
    },
    [loadAlerts],
  );

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 5000);
    return () => clearInterval(timer);
  }, [load]);

  useEffect(() => {
    void loadHist();
  }, [loadHist]);

  useEffect(() => {
    void loadAlerts();
    const timer = setInterval(() => void loadAlerts(), 30000);
    return () => clearInterval(timer);
  }, [loadAlerts]);

  if (error) return <p className="py-6 text-center text-[13px] text-red-500">{error}</p>;
  if (!data) return <p className="py-6 text-center text-[13px] text-muted">{t('common.loading')}</p>;

  const series = range === 'live' ? data.history : hist?.items ?? [];
  const cpuData = series.map((p) => p.cpu);
  const memData = series.map((p) => p.mem);
  const diskData = series.map((p) => p.disk);
  const rxData = series.map((p) => p.netRx);
  const txData = series.map((p) => p.netTx);
  const netMax = Math.max(1024, ...rxData, ...txData);
  const last = series.length ? series[series.length - 1] : data.current;
  const hasUnack = alerts.items.some((a) => !a.ack);

  const ranges: Array<{ key: RangeKey; label: string }> = [
    { key: 'live', label: t('metrics.rangeLive') },
    { key: '1h', label: t('metrics.range1h') },
    { key: '24h', label: t('metrics.range24h') },
    { key: '7d', label: t('metrics.range7d') },
  ];

  const kindLabel = (kind: string) =>
    kind === 'cpu' ? t('metrics.cpu') : kind === 'mem' ? t('metrics.memory') : t('metrics.disk');

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="text-[14px] font-medium">{t('metrics.title')}</h3>
        <span className="chip">
          {range === 'live'
            ? t('metrics.sampling', { n: data.history.length })
            : t('metrics.historyPoints', { n: series.length })}
        </span>
        <div className="ml-auto flex flex-wrap items-center gap-1">
          {ranges.map((r) => (
            <button
              key={r.key}
              className="btn"
              style={range === r.key ? { color: 'rgb(var(--brand))' } : undefined}
              onClick={() => setRange(r.key)}
            >
              {r.label}
            </button>
          ))}
          <button className="btn ml-1" onClick={() => void load()}>
            <Icon icon="mdi:refresh" size={16} title={t('common.refresh')} />
            {t('common.refresh')}
          </button>
        </div>
      </div>

      {range !== 'live' && series.length === 0 ? (
        <p className="rounded-xl border border-line p-4 text-[12px] text-muted">{t('metrics.historyEmpty')}</p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-line p-4">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[13px]">{t('metrics.cpu')}</span>
            <span className="text-[12px] text-muted">
              {t('metrics.cores', { n: data.cpu.count, load: data.cpu.loadAvg.join(' / ') })}
            </span>
          </div>
          <Sparkline data={cpuData} height={64} label={t('metrics.usage')} value={last.cpu} />
          <div className="mt-1 truncate text-[11px] text-muted">{data.cpu.model}</div>
        </div>

        <div className="rounded-xl border border-line p-4">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[13px]">{t('metrics.memory')}</span>
            <span className="text-[12px] text-muted">
              {data.memory.usedGb} / {data.memory.totalGb} GB
            </span>
          </div>
          <Sparkline data={memData} height={64} label={t('metrics.usage')} value={last.mem} color="#10b981" />
        </div>

        <div className="rounded-xl border border-line p-4">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[13px]">{t('metrics.disk')}</span>
            <span className="text-[12px] text-muted">
              {data.disk.usedGb} / {data.disk.totalGb} GB
            </span>
          </div>
          <div className="py-2">
            <div className="h-3 overflow-hidden rounded-full bg-line/70">
              <div
                className="h-3 rounded-full bg-amber-500"
                style={{ width: `${Math.min(100, data.disk.usedPercent)}%` }}
              />
            </div>
          </div>
          <Sparkline data={diskData} height={40} label={t('metrics.usage')} value={last.disk} color="#f59e0b" />
          <div className="mt-1 truncate text-[11px] text-muted">{data.disk.path}</div>
        </div>

        <div className="rounded-xl border border-line p-4">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[13px]">{t('metrics.network')}</span>
            <span className="text-[12px] text-muted">
              ↓ {fmtRate(last.netRx)} · ↑ {fmtRate(last.netTx)}
            </span>
          </div>
          <Sparkline
            data={rxData}
            height={64}
            max={netMax}
            label={t('metrics.down')}
            value={last.netRx}
            suffix=""
            color="#8b5cf6"
          />
          <div className="mt-1">
            <Sparkline
              data={txData}
              height={40}
              max={netMax}
              label={t('metrics.up')}
              value={last.netTx}
              suffix=""
              color="#f59e0b"
            />
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-line p-4">
        <div className="mb-2 flex items-center gap-2">
          <Icon icon="mdi:alert-outline" size={16} title={t('metrics.alerts')} />
          <span className="text-[13px]">{t('metrics.alerts')}</span>
          {alerts.unack > 0 ? <span className="chip text-red-500">{alerts.unack}</span> : null}
          {hasUnack ? (
            <button className="btn ml-auto" onClick={() => void ack()}>
              {t('metrics.ackAll')}
            </button>
          ) : null}
        </div>
        {alerts.items.length === 0 ? (
          <p className="text-[12px] text-muted">{t('metrics.alertEmpty')}</p>
        ) : (
          <ul className="space-y-1.5">
            {alerts.items.map((a) => (
              <li key={a.id} className="flex flex-wrap items-center gap-2 text-[12px]">
                <span className={a.ack ? 'text-muted' : ''}>
                  {kindLabel(a.kind)} ·{' '}
                  {t('metrics.alertOver', { value: a.value.toFixed(1), threshold: a.threshold.toFixed(1) })}
                </span>
                <span className="text-[11px] text-muted">{fmtTime(a.t)}</span>
                {a.ack ? (
                  <span className="ml-auto text-[11px] text-muted">{t('metrics.acked')}</span>
                ) : (
                  <button className="btn ml-auto" onClick={() => void ack(a.id)}>
                    {t('metrics.ack')}
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
