'use client';

import { useCallback, useEffect, useState } from 'react';
import { api, type DockerListResult } from '@/lib/api-client';
import { Icon } from './Icon';

export function DockerPanel({ toast }: { toast: (msg: string) => void }) {
  const [data, setData] = useState<DockerListResult | null>(null);
  const [logs, setLogs] = useState<{ name: string; text: string } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setData(await api.dockerContainers());
    } catch (err) {
      toast(err instanceof Error ? err.message : '读取失败');
    }
  }, [toast]);

  useEffect(() => {
    void load();
    const timer = setInterval(() => void load(), 10000);
    return () => clearInterval(timer);
  }, [load]);

  const act = async (id: string, action: 'start' | 'stop' | 'restart') => {
    setBusy(id + action);
    try {
      await api.dockerAction(id, action);
      toast(action === 'start' ? '已启动' : action === 'stop' ? '已停止' : '已重启');
      await load();
    } catch (err) {
      toast(err instanceof Error ? err.message : '操作失败');
    } finally {
      setBusy(null);
    }
  };

  const showLogs = async (id: string, name: string) => {
    try {
      const res = await api.dockerLogs(id, 300);
      setLogs({ name, text: res.logs || '（无日志输出）' });
    } catch (err) {
      toast(err instanceof Error ? err.message : '读取日志失败');
    }
  };

  if (!data) return <p className="py-6 text-center text-[13px] text-muted">加载中…</p>;

  if (!data.available) {
    return (
      <div className="space-y-2 py-4">
        <div className="flex items-center gap-2 text-[14px]">
          <Icon icon="mdi:docker" size={22} title="Docker" />
          未连接 Docker
        </div>
        <p className="text-[13px] text-muted">{data.message ?? '未检测到 Docker Socket'}</p>
        <p className="text-[12px] text-muted">
          部署时需要挂载宿主机 Socket：<code>-v /var/run/docker.sock:/var/run/docker.sock:ro</code>
          （群晖上只读挂载即可满足查看与控制）
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h3 className="text-[14px] font-medium">容器列表</h3>
        {data.info ? (
          <span className="chip">
            共 {data.info.containers} 个 · 运行 {data.info.running} · 停止 {data.info.stopped}
          </span>
        ) : null}
        {data.info?.version ? <span className="chip">Docker {data.info.version}</span> : null}
        <button className="btn ml-auto" onClick={() => void load()}>
          <Icon icon="mdi:refresh" size={16} title="刷新" />
          刷新
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
                <span className="chip">{running ? '运行中' : c.state}</span>
                <span className="truncate text-[12px] text-muted">{c.image}</span>

                <div className="ml-auto flex flex-wrap gap-1">
                  <button
                    className="btn btn-ghost"
                    disabled={!!busy}
                    onClick={() => void act(c.id, 'start')}
                    title="启动"
                  >
                    <Icon icon="mdi:play" size={16} title="启动" />
                  </button>
                  <button
                    className="btn btn-ghost"
                    disabled={!!busy}
                    onClick={() => void act(c.id, 'stop')}
                    title="停止"
                  >
                    <Icon icon="mdi:stop" size={16} title="停止" />
                  </button>
                  <button
                    className="btn btn-ghost"
                    disabled={!!busy}
                    onClick={() => void act(c.id, 'restart')}
                    title="重启"
                  >
                    <Icon icon="mdi:restart" size={16} title="重启" />
                  </button>
                  <button className="btn btn-ghost" onClick={() => void showLogs(c.id, c.name)}>
                    日志
                  </button>
                </div>
              </div>

              <div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-muted">
                <span>{c.status}</span>
                {c.ports.length ? (
                  <span>
                    端口：
                    {c.ports
                      .map((p) => (p.public ? `${p.public}→${p.private}` : `${p.private}`))
                      .join('，')}
                  </span>
                ) : (
                  <span>无端口映射</span>
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
              <h3 className="text-[15px] font-medium">{logs.name} 日志</h3>
              <button className="btn btn-ghost ml-auto" onClick={() => setLogs(null)}>
                <Icon icon="mdi:close" size={18} title="关闭" />
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
