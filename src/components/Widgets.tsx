'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, type DockerListResult, type MetricsResult } from '@/lib/api-client';
import { Icon } from './Icon';
import { Sparkline } from './Sparkline';
import { useI18n } from '@/i18n';

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

function fmtUptime(sec: number, t: (k: string, p?: Record<string, string | number>) => string): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (d) return `${d} ${t('common.day')} ${h} ${t('common.hour')}`;
  if (h) return `${h} ${t('common.hour')} ${m} ${t('common.minute')}`;
  return `${m} ${t('common.minute')}`;
}

export function Widgets({ showSystem, showDocker, refreshSec = 10 }: Props) {
  const { t } = useI18n();
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
      ) : null}

      {showDocker ? (
        <div className="card p-4">
          <div className="mb-2 flex items-center gap-1.5">
            <Icon icon="mdi:docker" size={17} title="Docker" />
            <span className="text-[13px] font-medium">{t('widget.containers')}</span>
            {docker?.available ? (
              <span className="ml-auto text-[11px] text-muted">
                {t('widget.running', {
                  r: docker.containers.filter((c) => c.state === 'running').length,
                  t: docker.containers.length,
                })}
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
                  <span
                    className="h-2 w-2 flex-none rounded-full"
                    style={{ background: c.state === 'running' ? '#22c55e' : '#94a3b8' }}
                  />
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
      ) : null}
    </div>
  );
}
