'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, type MetricsResult } from '@/lib/api-client';
import { Icon } from './Icon';
import { Sparkline } from './Sparkline';
import { useI18n } from '@/i18n';

function fmtRate(bytes: number): string {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(2)} MB/s`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB/s`;
  return `${bytes} B/s`;
}

export function MetricsPanel() {
  const { t } = useI18n();
  const [data, setData] = useState<MetricsResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api.metrics());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : t('common.loadFailed'));
    }
  }, [t]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 5000);
    return () => clearInterval(timer);
  }, [load]);

  if (error) return <p className="py-6 text-center text-[13px] text-red-500">{error}</p>;
  if (!data) return <p className="py-6 text-center text-[13px] text-muted">{t('common.loading')}</p>;

  const cpuData = data.history.map((p) => p.cpu);
  const memData = data.history.map((p) => p.mem);
  const rxData = data.history.map((p) => p.netRx);
  const txData = data.history.map((p) => p.netTx);
  const netMax = Math.max(1024, ...rxData, ...txData);

  return (
    <div className="space-y-5">
      <div className="flex items-center">
        <h3 className="text-[14px] font-medium">{t('metrics.title')}</h3>
        <span className="chip ml-2">{t('metrics.sampling', { n: data.history.length })}</span>
        <button className="btn ml-auto" onClick={() => void load()}>
          <Icon icon="mdi:refresh" size={16} title={t('common.refresh')} />
          {t('common.refresh')}
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-line p-4">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[13px]">{t('metrics.cpu')}</span>
            <span className="text-[12px] text-muted">
              {t('metrics.cores', { n: data.cpu.count, load: data.cpu.loadAvg.join(' / ') })}
            </span>
          </div>
          <Sparkline data={cpuData} height={64} label={t('metrics.usage')} value={data.current.cpu} />
          <div className="mt-1 truncate text-[11px] text-muted">{data.cpu.model}</div>
        </div>

        <div className="rounded-xl border border-line p-4">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[13px]">{t('metrics.memory')}</span>
            <span className="text-[12px] text-muted">
              {data.memory.usedGb} / {data.memory.totalGb} GB
            </span>
          </div>
          <Sparkline data={memData} height={64} label={t('metrics.usage')} value={data.current.mem} color="#10b981" />
        </div>

        <div className="rounded-xl border border-line p-4">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[13px]">{t('metrics.disk')}</span>
            <span className="text-[12px] text-muted">
              {data.disk.usedGb} / {data.disk.totalGb} GB
            </span>
          </div>
          <div className="py-3">
            <div className="h-3 overflow-hidden rounded-full bg-line/70">
              <div
                className="h-3 rounded-full bg-amber-500"
                style={{ width: `${Math.min(100, data.disk.usedPercent)}%` }}
              />
            </div>
            <div className="mt-1 text-right text-[13px] font-medium">{data.disk.usedPercent}%</div>
          </div>
          <div className="truncate text-[11px] text-muted">{data.disk.path}</div>
        </div>

        <div className="rounded-xl border border-line p-4">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[13px]">{t('metrics.network')}</span>
            <span className="text-[12px] text-muted">
              ↓ {fmtRate(data.current.netRx)} · ↑ {fmtRate(data.current.netTx)}
            </span>
          </div>
          <Sparkline
            data={rxData}
            height={64}
            max={netMax}
            label={t('metrics.down')}
            value={data.current.netRx}
            suffix=""
            color="#8b5cf6"
          />
          <div className="mt-1">
            <Sparkline
              data={txData}
              height={40}
              max={netMax}
              label={t('metrics.up')}
              value={data.current.netTx}
              suffix=""
              color="#f59e0b"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
