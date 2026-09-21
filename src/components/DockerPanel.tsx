'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, type DockerListResult } from '@/lib/api-client';
import { Icon } from './Icon';
import { useI18n } from '@/i18n';

export function DockerPanel({ toast }: { toast: (msg: string) => void }) {
  const { t } = useI18n();
  const [data, setData] = useState<DockerListResult | null>(null);
  const [logs, setLogs] = useState<{ name: string; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api.dockerContainers());
    } catch (err) {
      toast(err instanceof Error ? err.message : t('common.loadFailed'));
    }
  }, [toast, t]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 10000);
    return () => clearInterval(timer);
  }, [load]);

  const act = async (id: string, action: 'start' | 'stop' | 'restart') => {
    setBusy(id + action);
    try {
      await api.dockerAction(id, action);
      toast(action === 'start' ? t('docker.started') : action === 'stop' ? t('docker.stopped') : t('docker.restarted'));
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : t('common.operationFailed'));
    } finally {
      setBusy(null);
    }
  };

  const showLogs = async (id: string, name: string) => {
    try {
      const res = await api.dockerLogs(id, 300);
      setLogs({ name, text: res.logs || t('docker.noLogs') });
    } catch (err) {
      toast(err instanceof Error ? err.message : t('docker.logsFailed'));
    }
  };

  if (!data) return <p className="py-6 text-center text-[13px] text-muted">{t('common.loading')}</p>;

  if (!data.available) {
    return (
      <div className="space-y-2 py-4">
        <div className="flex items-center gap-2 text-[14px]">
          <Icon icon="mdi:docker" size={22} title="Docker" />
          {t('docker.notConnected')}
        </div>
        <p className="text-[13px] text-muted">{data.message ?? t('docker.noSocket')}</p>
        <p className="text-[12px] text-muted">{t('docker.socketTip')}</p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="text-[14px] font-medium">{t('docker.title')}</h3>
        {data.info ? (
          <span className="chip">
            {t('docker.total', { t: data.info.containers, r: data.info.running, s: data.info.stopped })}
          </span>
        ) : null}
        {data.info?.version ? <span className="chip">Docker {data.info.version}</span> : null}
        <button className="btn ml-auto" onClick={() => void load()}>
          <Icon icon="mdi:refresh" size={16} title={t('common.refresh')} />
          {t('common.refresh')}
        </button>
      </div>

      <div className="space-y-2">
        {data.containers.map((c) => {
          const running = c.state === 'running';
          return (
            <div key={c.id} className="rounded-xl border border-line p-3">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="h-2.5 w-2.5 flex-none rounded-full"
                  style={{ background: running ? '#22c55e' : '#94a3b8' }}
                />
                <span className="text-[14px] font-medium">{c.name}</span>
                <span className="chip">{running ? t('common.running') : c.state}</span>
                <span className="truncate text-[12px] text-muted">{c.image}</span>

                <div className="ml-auto flex flex-wrap gap-1">
                  <button
                    className="btn btn-ghost"
                    disabled={!!busy}
                    onClick={() => void act(c.id, 'start')}
                    title={t('docker.start')}
                  >
                    <Icon icon="mdi:play" size={16} title={t('docker.start')} />
                  </button>
                  <button
                    className="btn btn-ghost"
                    disabled={!!busy}
                    onClick={() => void act(c.id, 'stop')}
                    title={t('docker.stop')}
                  >
                    <Icon icon="mdi:stop" size={16} title={t('docker.stop')} />
                  </button>
                  <button
                    className="btn btn-ghost"
                    disabled={!!busy}
                    onClick={() => void act(c.id, 'restart')}
                    title={t('docker.restart')}
                  >
                    <Icon icon="mdi:restart" size={16} title={t('docker.restart')} />
                  </button>
                  <button className="btn btn-ghost" onClick={() => void showLogs(c.id, c.name)}>
                    {t('docker.logs')}
                  </button>
                </div>
              </div>

              <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-muted">
                <span>{c.status}</span>
                {c.ports.length ? (
                  <span>
                    {t('docker.ports', {
                      list: c.ports.map((p) => (p.public ? `${p.public}→${p.private}` : `${p.private}`)).join('，'),
                    })}
                  </span>
                ) : (
                  <span>{t('docker.noPorts')}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {logs ? (
        <div className="modal-backdrop" onClick={() => setLogs(null)}>
          <div className="modal max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <div className="mb-3 flex items-center">
              <h3 className="text-[15px] font-medium">{t('docker.logsTitle', { name: logs.name })}</h3>
              <button className="btn btn-ghost ml-auto" onClick={() => setLogs(null)}>
                <Icon icon="mdi:close" size={18} title={t('common.close')} />
              </button>
            </div>
            <pre className="max-h-[60vh] overflow-auto rounded-lg bg-canvas p-3 font-mono text-[12px] leading-relaxed">
              {logs.text}
            </pre>
          </div>
        </div>
      ) : null}
    </div>
  );
}
