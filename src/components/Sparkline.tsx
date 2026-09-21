'use client';

interface Props {
  data: number[];
  max?: number;
  color?: string;
  height?: number;
  label?: string;
  suffix?: string;
  value?: number;
}

/** 极简 SVG 折线图，不引入图表库，保持包体积与内存占用 */
export function Sparkline({ data, max = 100, color = 'rgb(var(--brand))', height = 40, label, suffix = '%', value }: Props) {
  const points = data.length >= 2 ? data : [0, 0];
  const peak = Math.max(max, ...points) || 1;

  const coords = points.map((v, i) => {
    const x = (i / (points.length - 1)) * 100;
    const y = height - (Math.min(v, peak) / peak) * (height - 4) - 2;
    return `${x.toFixed(2)},${y.toFixed(2)}`;
  });

  const line = coords.join(' ');
  const area = `0,${height} ${line} 100,${height}`;

  return (
    <div className="flex items-center gap-3">
      <svg
        viewBox={`0 0 100 ${height}`}
        preserveAspectRatio="none"
        className="h-10 w-full flex-1"
        aria-hidden="true"
      >
        <polygon points={area} fill={color} opacity="0.16" />
        <polyline points={line} fill="none" stroke={color} strokeWidth="1.6" strokeLinejoin="round" />
      </svg>
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
