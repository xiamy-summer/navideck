/**
 * 主题预设：一键切换 accent + 背景色（亮/暗各一套 canvas）。
 * 单一数据源：layout.tsx 用它生成 data-preset CSS 规则，设置中心用它渲染色卡。
 */
export interface ThemePreset {
  id: string;
  label: string;
  accent: string;
  canvasLight: string;
  canvasDark: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  { id: 'blue', label: '蓝', accent: '#3b82f6', canvasLight: '243 245 249', canvasDark: '13 16 23' },
  { id: 'purple', label: '紫', accent: '#8b5cf6', canvasLight: '245 243 250', canvasDark: '18 14 30' },
  { id: 'green', label: '绿', accent: '#10b981', canvasLight: '240 248 244', canvasDark: '10 22 17' },
  { id: 'warm', label: '暖橙', accent: '#f97316', canvasLight: '250 246 240', canvasDark: '27 19 12' },
  { id: 'rose', label: '玫红', accent: '#f43f5e', canvasLight: '251 244 246', canvasDark: '29 13 18' },
  { id: 'cyan', label: '青', accent: '#06b6d4', canvasLight: '240 248 250', canvasDark: '10 22 27' },
];

export function presetById(id: string | undefined | null): ThemePreset | undefined {
  if (!id) return undefined;
  return THEME_PRESETS.find((p) => p.id === id);
}

/** 必有返回：未知 id 时兜底第一个预设 */
export function getPreset(id?: string | null): ThemePreset {
  return presetById(id) ?? THEME_PRESETS[0];
}

export function hexToRgb(hex: string): string {
  const value = hex.replace('#', '');
  const full =
    value.length === 3
      ? value
          .split('')
          .map((c) => c + c)
          .join('')
      : value;
  const num = Number.parseInt(full, 16);
  if (Number.isNaN(num)) return '59 130 246';
  return `${(num >> 16) & 255} ${(num >> 8) & 255} ${num & 255}`;
}

/** 由服务端在 layout 中内联输出：html[data-preset] 切换 --brand / --canvas（亮暗两套） */
export function presetCss(): string {
  return THEME_PRESETS.map(
    (p) =>
      `html[data-preset="${p.id}"]{--brand:${hexToRgb(p.accent)};--canvas:${p.canvasLight};}html.dark[data-preset="${p.id}"]{--canvas:${p.canvasDark};}`,
  ).join('');
}
