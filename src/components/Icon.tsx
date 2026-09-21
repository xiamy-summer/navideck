'use client';

import { useEffect, useState } from 'react';

export const ICONIFY_API = process.env.NEXT_PUBLIC_ICONIFY_API || 'https://api.iconify.design';

export function iconUrl(icon: string) {
  return `${ICONIFY_API}/${icon.replace(':', '/')}.svg`;
}

const status = new Map<string, boolean>();

interface Props {
  icon?: string | null;
  size?: number;
  className?: string;
  title?: string;
}

/**
 * 使用 CSS mask 渲染 Iconify 图标：
 * - 颜色跟随 currentColor，自动适配亮/暗主题
 * - 加载失败时降级为文字首字，不会留白
 */
export function Icon({ icon, size = 24, className, title }: Props) {
  const [failed, setFailed] = useState(false);
  const valid = !!icon && icon.includes(':');

  useEffect(() => {
    if (!valid) return;
    const url = iconUrl(icon as string);
    const known = status.get(url);
    if (known !== undefined) {
      setFailed(!known);
      return;
    }
    let alive = true;
    const probe = new Image();
    probe.onload = () => {
      status.set(url, true);
      if (alive) setFailed(false);
    };
    probe.onerror = () => {
      status.set(url, false);
      if (alive) setFailed(true);
    };
    probe.src = url;
    return () => {
      alive = false;
    };
  }, [icon, valid]);

  if (!valid || failed) {
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
