'use client';

import { useEffect, useState } from 'react';
import { Icon as IconifyIcon, addCollection, iconLoaded } from '@iconify/react';

export const ICONIFY_API = process.env.NEXT_PUBLIC_ICONIFY_API || 'https://api.iconify.design';

export function iconUrl(icon: string) {
  return `${ICONIFY_API}/${icon.replace(':', '/')}.svg`;
}

// 离线图标包（public/icon-pack/collection.json，随镜像同源发布，断网可读）
const PACK_URL = '/icon-pack/collection.json';

let packPromise: Promise<void> | null = null;
function ensurePack() {
  if (!packPromise) {
    packPromise = fetch(PACK_URL)
      .then((r) => r.json())
      .then((data: Record<string, unknown>) => {
        Object.values(data).forEach((col) => {
          if (col && typeof col === 'object') addCollection(col as never);
        });
      })
      .catch(() => {
        /* 离线包加载失败则整体回退到在线 API，不影响使用 */
      });
  }
  return packPromise;
}

const status = new Map<string, boolean>();

interface Props {
  icon?: string | null;
  size?: number;
  className?: string;
  title?: string;
}

/**
 * 图标渲染（离线优先）：
 * 1. 命中本地离线包 → 内联 SVG，颜色跟随 currentColor，断网也能渲染，自动适配亮/暗主题；
 * 2. 未命中 → 走 Iconify API（CSS mask，需外网）；
 * 3. 都失败 → 降级为文字首字占位，不会留白。
 */
export function Icon({ icon, size = 24, className, title }: Props) {
  const valid = !!icon && icon.includes(':');
  // 图片地址（Sun-Panel 等第三方导入的自定义图标）不走 Iconify，直接按 <img> 渲染
  const isImage = !!icon && /^(https?:\/\/|data:image\/)/i.test(icon);
  const [packReady, setPackReady] = useState(false);
  const [onlineFailed, setOnlineFailed] = useState(false);

  useEffect(() => {
    let alive = true;
    ensurePack().then(() => {
      if (alive) setPackReady(true);
    });
    return () => {
      alive = false;
    };
  }, []);

  // 在线兜底探测（仅对未打包的图标），用于失败降级
  useEffect(() => {
    if (!valid) return;
    if (packReady && iconLoaded(icon as string)) {
      setOnlineFailed(false);
      return;
    }
    const url = iconUrl(icon as string);
    const known = status.get(url);
    if (known !== undefined) {
      setOnlineFailed(!known);
      return;
    }
    let alive = true;
    const probe = new Image();
    probe.onload = () => {
      status.set(url, true);
      if (alive) setOnlineFailed(false);
    };
    probe.onerror = () => {
      status.set(url, false);
      if (alive) setOnlineFailed(true);
    };
    probe.src = url;
    return () => {
      alive = false;
    };
  }, [icon, valid, packReady]);

  // 0) 图片地址 → 直接 <img>（用于第三方导入的自定义 logo）
  if (isImage) {
    return (
      <img
        src={icon as string}
        alt={title || ''}
        className={className}
        style={{
          width: size,
          height: size,
          objectFit: 'contain',
          borderRadius: Math.round(size * 0.22),
          flex: 'none',
          display: 'inline-block',
        }}
      />
    );
  }

  // 1) 离线包命中 → 内联 SVG（断网可用，随主题变色）
  if (valid && packReady && iconLoaded(icon as string)) {
    return (
      <IconifyIcon
        icon={icon as string}
        width={size}
        height={size}
        className={className}
        style={{ flex: 'none', display: 'inline-block' }}
      />
    );
  }

  // 2/3) 在线（CSS mask）或失败降级为首字占位
  if (!valid || onlineFailed) {
    const initial = (title || icon || '?').trim().charAt(0).toUpperCase();
    return (
      <span
        className={className}
        style={{
          width: size,
          height: size,
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: Math.round(size * 0.28),
          background: 'rgb(var(--brand) / 0.14)',
          color: 'rgb(var(--brand))',
          fontSize: Math.max(11, Math.round(size * 0.45)),
          fontWeight: 500,
          flex: 'none',
        }}
      >
        {initial}
      </span>
    );
  }

  const url = iconUrl(icon as string);
  return (
    <span
      className={className}
      aria-hidden
      style={{
        width: size,
        height: size,
        display: 'inline-block',
        flex: 'none',
        backgroundColor: 'currentColor',
        maskImage: `url("${url}")`,
        WebkitMaskImage: `url("${url}")`,
        maskRepeat: 'no-repeat',
        WebkitMaskRepeat: 'no-repeat',
        maskSize: 'contain',
        WebkitMaskSize: 'contain',
        maskPosition: 'center',
        WebkitMaskPosition: 'center',
      }}
    />
  );
}
