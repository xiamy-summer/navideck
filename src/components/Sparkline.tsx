'use client';

import { useId } from 'react';

interface Props {
  data: number[];
  max?: number;
  color?: string;
  height?: number;
  label?: string;
  suffix?: string;
  value?: number;
  /** 仅渲染曲线本身，数值由外部布局渲染 */
  bare?: boolean;
}

/** 极简 SVG 折线图，不引入图表库，保持包体积与内存占用 */
export function Sparkline({
  data,
  max = 100,
  color = 'rgb(var(--brand))',
  height = 34,
  label,
  suffix = '%',
  value,
  bare = false,
}: Props) {
  // useId 生成的 id 含 ':'，不能直接放进 url(#...)，需剔除
  const gid = `spark-${useId().replace(/[^a-zA-Z0-9]/g, '')}`;
  const points = data.length >= 2 ? data : [0, 0];
  const peak = Math.max(max, ...points) || 1;

  const coords = points.map((v, i) => {
    const x = (i / (points.length - 1)) * 100;
    const y = height - (Math.min(v, peak) / peak) * (height - 6) - 3;
    return { x, y };
  });

  const line = coords.map((p) => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(' ');
  const area = `0,${height} ${line} 100,${height}`;
  const last = coords[coords.length - 1];

  const chart = (
    <div className={`relative ${bare ? 'h-8 flex-1' : 'h-10 flex-1'}`}>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="h-full w-full" aria-hidden="true">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.3" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon points={area} fill={`url(#${gid})`} />
        <polyline
          points={line}
          fill="none"
          stroke={color}
          strokeWidth="1.6"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect="non-scaling-stroke"
        />
      </svg>
      {/* 末端圆点用 DOM 渲染，避免 viewBox 非等比缩放把它拉成椭圆 */}
      <span
        className="pointer-events-none absolute h-[5px] w-[5px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ left: `${last.x}%`, top: `${(last.y / height) * 100}%`, background: color }}
      />
    </div>
  );

  if (bare) return chart;

  return (
    <div className="flex items-center gap-3">
      {chart}
      {label ? (
        <div className="w-24 text-right">
          <div className="text-[11px] text-muted">{label}</div>
          <div className="text-[14px] font-medium">
            {value ?? Math.round(points[points.length - 1])}
            {suffix}
          </div>
        </div>
      ) : null}
    </div>
  );
}
