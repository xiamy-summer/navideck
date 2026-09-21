'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, type MetricsResult } from '@/lib/api-client';
import { Icon } from './Icon';
import { Sparkline } from './Sparkline';

function fmtRate(bytes: number): string {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(2)} MB/s`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB/s`;
  return `${bytes} B/s`;
}

export function MetricsPanel() {
  const [data, setData] = useState<MetricsResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api.metrics());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '读取失败');
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 5000);
    return () => clearInterval(timer);
  }, [load]);

  if (error) return <p className="py-6 text-center text-[13px] text-red-500">{error}</p>;
  if (!data) return <p className="py-6 text-center text-[13px] text-muted">加载中…</p>;

  const cpuData = data.history.map((p) => p.cpu);
  const memData = data.history.map((p) => p.mem);
  const rxData = data.history.map((p) => p.netRx);
  const txData = data.history.map((p) => p.netTx);
  const netMax = Math.max(1024, ...rxData, ...txData);

  return (
    <div className="space-y-5">
      <div className="flex items-center">
        <h3 className="text-[14px] font-medium">实时监控</h3>
        <span className="chip ml-2">每 5 秒采样，保留最近 {data.history.length} 点</span>
        <button className="btn ml-auto" onClick={() => void load()}>
          <Icon icon="mdi:refresh" size={16} title="刷新" />
          刷新
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-line p-4">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[13px]">CPU</span>
            <span className="text-[12px] text-muted">
              {data.cpu.count} 核 · 负载 {data.cpu.loadAvg.join(' / ')}
            </span>
          </div>
          <Sparkline data={cpuData} height={64} label="使用率" value={data.current.cpu} />
          <div className="mt-1 truncate text-[11px] text-muted">{data.cpu.model}</div>
        </div>

        <div className="rounded-xl border border-line p-4">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[13px]">内存</span>
            <span className="text-[12px] text-muted">
              {data.memory.usedGb} / {data.memory.totalGb} GB
            </span>
          </div>
          <Sparkline data={memData} height={64} label="使用率" value={data.current.mem} color="#10b981" />
        </div>

        <div className="rounded-xl border border-line p-4">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-[13px]">磁盘</span>
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
            <span className="text-[13px]">网络速率</span>
            <span className="text-[12px] text-muted">
              ↓ {fmtRate(data.current.netRx)} · ↑ {fmtRate(data.current.netTx)}
            </span>
          </div>
          <Sparkline
            data={rxData}
            height={64}
            max={netMax}
            label="下行"
            value={data.current.netRx}
            suffix=""
            color="#8b5cf6"
          />
          <div className="mt-1">
            <Sparkline
              data={txData}
              height={40}
              max={netMax}
              label="上行"
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
