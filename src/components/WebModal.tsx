'use client';

import { useEffect, useState } from 'react';
import { Icon } from './Icon';

interface Props {
  url: string | null;
  title?: string;
  onClose: () => void;
}

/** 内置小窗口：用于 iframe 打开三方站点（部分站点会因 X-Frame-Options 拒绝嵌入） */
export function WebModal({ url, title, onClose }: Props) {
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    setBlocked(false);
    if (!url) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, [url, onClose]);

  if (!url) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="flex h-[86vh] w-full max-w-5xl animate-pop flex-col overflow-hidden rounded-2xl border border-line bg-surface"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-none items-center gap-2 border-b border-line px-4 py-2.5">
          <Icon icon="mdi:web" size={20} title={title || '网页'} />
          <span className="truncate text-[14px] font-medium">{title || '网页'}</span>
          <span className="ml-2 hidden truncate text-[12px] text-muted sm:block">{url}</span>
          <div className="ml-auto flex items-center gap-1">
            <button
              className="btn btn-ghost"
              title="在新标签页打开"
              onClick={() => window.open(url, '_blank', 'noopener')}
            >
              <Icon icon="mdi:open-in-new" size={18} title="新窗口" />
            </button>
            <button className="btn btn-ghost" title="刷新" onClick={() => setBlocked((v) => !v)}>
              <Icon icon="mdi:refresh" size={18} title="刷新" />
            </button>
            <button className="btn btn-ghost" onClick={onClose} title="关闭">
              <Icon icon="mdi:close" size={20} title="关闭" />
            </button>
          </div>
        </div>

        <div className="relative flex-1 bg-canvas">
          {blocked ? (
            <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
              <Icon icon="mdi:shield-alert-outline" size={40} title="!" />
              <p className="text-[14px]">该站点拒绝被嵌入（X-Frame-Options / CSP 限制）</p>
              <button className="btn btn-primary" onClick={() => window.open(url, '_blank', 'noopener')}>
                在新标签页打开
              </button>
            </div>
          ) : (
            <iframe
              key={url}
              src={url}
              title={title}
              className="h-full w-full border-0"
              referrerPolicy="no-referrer"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-popups-to-escape-sandbox"
              onLoad={(e) => {
                // 多数被拦截的站点会返回空文档，这里给出兜底提示入口
                try {
                  const doc = (e.target as HTMLIFrameElement).contentDocument;
                  if (doc && doc.location.href === 'about:blank') setBlocked(true);
                } catch {
                  /* 跨域无法访问，属正常情况 */
                }
              }}
            />
          )}
        </div>

        {!blocked ? (
          <div className="flex-none border-t border-line px-4 py-2 text-[12px] text-muted">
            若页面空白，说明该站点禁止嵌入，请点右上角在新标签页打开。
          </div>
        ) : null}
      </div>
    </div>
  );
}
