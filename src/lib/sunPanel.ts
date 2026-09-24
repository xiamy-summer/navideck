import { createGroup, createItem, deleteGroup, listGroups } from './db';
import type { OpenMode } from './types';

/**
 * Sun-Panel 导出格式的解析与导入。
 *
 * Sun-Panel 的层级是 icons[]（分组，每个含 children）→ children[]（站点），
 * 这里映射为 NaviDeck 的 groups / items：
 *   分组.title        → 分组名
 *   站点.url          → 外网地址（urlWan）
 *   站点.lanUrl       → 内网地址（urlLan）
 *   站点.description  → 描述
 *   站点.icon.src     → 图标（仅接受可直接访问的图片地址）
 *   站点.expandParam.containerName → 关联容器名（首页卡片的状态点）
 */

export interface SunPanelItemIcon {
  src?: string | null;
  text?: string | null;
  backgroundColor?: string | null;
}

export interface SunPanelItem {
  title?: string;
  url?: string;
  lanUrl?: string;
  description?: string;
  sort?: number;
  openMethod?: number;
  icon?: SunPanelItemIcon | null;
  expandParam?: { containerId?: string; containerName?: string } | null;
}

export interface SunPanelGroup {
  title?: string;
  sort?: number;
  children?: SunPanelItem[];
}

export interface SunPanelConfig {
  version?: number;
  appName?: string;
  appVersion?: string;
  icons?: SunPanelGroup[];
}

export interface ParsedSunPanelItem {
  title: string;
  urlWan: string;
  urlLan: string;
  desc: string;
  icon: string | null;
  container: string | null;
}

export interface ParsedSunPanelGroup {
  name: string;
  items: ParsedSunPanelItem[];
}

/**
 * 只接受迁移后仍可直接访问的图标地址：
 * http(s) 与 data:image 保留；/uploads/ 这类相对路径指向原 Sun-Panel 实例，迁移后不可达，直接忽略。
 */
export function normalizeSunPanelIcon(src?: string | null): string | null {
  if (!src) return null;
  const s = src.trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  if (/^data:image\//i.test(s)) return s;
  return null;
}

const bySort = (a?: number, b?: number) => (a ?? 9999) - (b ?? 9999);

export function parseSunPanel(raw: string): ParsedSunPanelGroup[] {
  let data: SunPanelConfig;
  try {
    data = JSON.parse(raw) as SunPanelConfig;
  } catch {
    throw new Error('不是合法的 JSON 文件');
  }

  const icons = Array.isArray(data?.icons) ? data.icons : [];
  if (!icons.length) throw new Error('文件里没有找到分组（icons 字段为空）');

  const groups: ParsedSunPanelGroup[] = [];
  for (const g of [...icons].sort((a, b) => bySort(a.sort, b.sort))) {
    const children = Array.isArray(g?.children) ? g.children : [];
    const items = [...children]
      .sort((a, b) => bySort(a.sort, b.sort))
      .map((c) => ({
        title: (c.title || c.url || '').trim() || '未命名',
        urlWan: (c.url || '').trim(),
        urlLan: (c.lanUrl || c.url || '').trim(),
        desc: (c.description || '').trim(),
        icon: normalizeSunPanelIcon(c.icon?.src),
        container: (c.expandParam?.containerName || '').trim() || null,
      }))
      .filter((i) => i.urlWan || i.urlLan);

    if (!items.length) continue;
    groups.push({ name: (g.title || '').trim() || '未命名分组', items });
  }

  if (!groups.length) throw new Error('没有解析到任何可用站点');
  return groups;
}

/** 解析 Sun-Panel 配置并写入数据库（mode=replace 时先清空现有分组） */
export function importSunPanel(
  userId: number,
  raw: string,
  mode: 'replace' | 'append',
): { groupCount: number; itemCount: number; iconCount: number } {
  const parsed = parseSunPanel(raw);
  if (mode === 'replace') {
    for (const g of listGroups(userId)) deleteGroup(userId, g.id);
  }

  let itemCount = 0;
  let iconCount = 0;
  for (const g of parsed) {
    const group = createGroup(userId, g.name, null);
    for (const item of g.items) {
      createItem(userId, {
        groupId: group.id,
        title: item.title,
        icon: item.icon,
        urlLan: item.urlLan,
        urlWan: item.urlWan,
        desc: item.desc,
        // Sun-Panel 的 openMethod 语义与本站不完全一致，统一按新标签页导入，
        // 导入后可在站点编辑里逐个调整
        openMode: 'blank' as OpenMode,
        color: null,
        container: item.container,
      });
      itemCount += 1;
      if (item.icon) iconCount += 1;
    }
  }
  return { groupCount: parsed.length, itemCount, iconCount };
}
