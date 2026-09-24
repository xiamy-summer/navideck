'use client';

import { useEffect } from 'react';

/**
 * 生产环境注册 Service Worker，实现「安装到桌面 / 离线可用」。
 * 开发环境不注册，避免缓存干扰热更新。
 */
export function PwaRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return;
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;

    let cancelled = false;
    const register = () => {
      if (cancelled) return;
      navigator.serviceWorker
        .register('/sw.js')
        .catch(() => {
          /* 浏览器不支持或注册失败时静默降级，不影响正常使用 */
        });
    };

    // 等页面加载完成再注册，避免与首屏渲染争抢带宽
    if (document.readyState === 'complete') register();
    else window.addEventListener('load', register);

    return () => {
      cancelled = true;
      window.removeEventListener('load', register);
    };
  }, []);

  return null;
}
