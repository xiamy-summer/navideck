'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, type DockerListResult, type MetricsResult } from '@/lib/api-client';
import { Icon } from './Icon';
import { Sparkline } from './Sparkline';

interface Props {
  showSystem: boolean;
  showDocker: boolean;
  refreshSec?: number;
}

function fmtRate(bytes: number): string {
  if (bytes >= 1048576) return `${(bytes / 1048576).toFixed(1)} MB/s`;
  if (bytes >= 1024) return `${(bytes / 1024).toFixed(0)} KB/s`;
  return `${bytes} B/s`;
}

function fmtUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d) return `${d} 天 ${h} 小时`;
  if (h) return `${h} 小时 ${m} 分`;
  return `${m} 分钟`;
}

export function Widgets({ showSystem, showDocker, refreshSec = 10 }: Props) {
  const [metrics, setMetrics] = useState<MetricsResult | null>(null);
  const [docker, setDocker] = useState<DockerListResult | null>(null);

  const load = useCallback(async () => {
    if (showSystem) {
      try {
        setMetrics(await api.metrics());
      } catch {
        /* 忽略单次失败 */
      }
    }
    if (showDocker) {
      try {
        setDocker(await api.dockerContainers());
      } catch {
        /* 忽略单次失败 */
      }
    }
  }, [showSystem, showDocker]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), Math.max(5, refreshSec) * 1000);
    return () => clearInterval(timer);
  }, [load, refreshSec]);

  if (!showSystem && !showDocker) return null;

  const cpuHistory = metrics?.history.map((p) => p.cpu) ?? [];
  const memHistory = metrics?.history.map((p) => p.mem) ?? [];

  return (
    <div className="mb-5 grid gap-3 sm:grid-cols-2">
      {showSystem ? (
        <div className="card p-4">
          <div className="mb-2 flex items-center gap-1.5">
            <Icon icon="mdi:chip" size={17} title="系统" />
            <span className="text-[13px] font-medium">系统</span>
            <span className="ml-auto text-[11px] text-muted">
              {metrics ? `负载 ${metrics.cpu.loadAvg[0]}` : '加载中…'}
            </span>
          </div>

          <Sparkline data={cpuHistory} label="CPU" value={metrics?.current.cpu} />
          <div className="mt-1">
            <Sparkline
              data={memHistory}
              label="内存"
              value={metrics?.current.mem}
              color="#10b981"
            />
          </div>

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
            <span>磁盘 {metrics?.disk.usedPercent ?? 0}%</span>
            <span>
              {metrics ? `${metrics.disk.usedGb} / ${metrics.disk.totalGb} GB` : ''}
            </span>
            <span>↓ {fmtRate(metrics?.current.netRx ?? 0)}</span>
            <span>↑ {fmtRate(metrics?.current.netTx ?? 0)}</span>
            <span>开机 {metrics ? fmtUptime(metrics.osUptime) : ''}</span>
          </div>
        </div>
      ) : null}

      {showDocker ? (
        <div className="card p-4">
          <div className="mb-2 flex items-center gap-1.5">
            <Icon icon="mdi:docker" size={17} title="Docker" />
            <span className="text-[13px] font-medium">容器</span>
            {docker?.available ? (
              <span className="ml-auto text-[11px] text-muted">
                运行中 {docker.containers.filter((c) => c.state === 'running').length} / {docker.containers.length}
              </span>
            ) : (
              <span className="ml-auto text-[11px] text-muted">未连接</span>
            )}
          </div>

          {!docker ? (
            <p className="py-4 text-[12px] text-muted">加载中…</p>
          ) : !docker.available ? (
            <p className="py-2 text-[12px] text-muted">
              未检测到 Docker Socket（{docker.socket}）
            </p>
          ) : docker.containers.length === 0 ? (
            <p className="py-4 text-[12px] text-muted">暂无容器</p>
          ) : (
            <div className="space-y-1">
              {docker.containers.slice(0, 5).map((c) => (
                <div key={c.id} className="flex items-center gap-2 text-[12px]">
                  <span
                    className="h-2 w-2 flex-none rounded-full"
                    style={{ background: c.state === 'running' ? '#22c55e' : '#94a3b8' }}
                  />
                  <span className="truncate">{c.name}</span>
                  <span className="ml-auto flex-none text-[11px] text-muted">{c.status}</span>
                </div>
              ))}
              {docker.containers.length > 5 ? (
                <div className="text-[11px] text-muted">还有 {docker.containers.length - 5} 个…</div>
              ) : null}
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
