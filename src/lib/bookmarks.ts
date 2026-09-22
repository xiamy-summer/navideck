import { createGroup, createItem, deleteGroup, listGroups } from './db';
import type { OpenMode } from './types';

export interface ParsedBookmarkItem {
  title: string;
  url: string;
  desc?: string;
}

export interface ParsedBookmarkGroup {
  name: string;
  items: ParsedBookmarkItem[];
}

function stripHtml(s: string): string {
  return s
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function attr(attrs: string, name: string): string | undefined {
  const m = attrs.match(new RegExp(`${name}\\s*=\\s*["']([^"']*)["']`, 'i'));
  return m ? stripHtml(m[1]) : undefined;
}

/**
 * 解析 Netscape Bookmark File Format（Chrome / Edge / Firefox 导出的 HTML 书签）。
 * 顺序扫描 <DL> / </DL> / <H3> / <A> 令牌，用栈维护文件夹层级；分组索引直接存入栈，
 * 解析结束后过滤掉没有任何书签的空文件夹。
 */
export function parseBookmarks(html: string): ParsedBookmarkGroup[] {
  const re =
    /<DL\b[^>]*>|<\/DL>|<H3\b[^>]*>([\s\S]*?)<\/H3>|<A\b([^>]*)>([\s\S]*?)<\/A>/gi;
  const tokens: Array<
    | { t: 'DL' }
    | { t: '/DL' }
    | { t: 'H3'; name: string }
    | { t: 'A'; href: string; title: string }
  > = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(html))) {
    const raw = m[0];
    if (raw.startsWith('</DL>')) tokens.push({ t: '/DL' });
    else if (raw.startsWith('<DL')) tokens.push({ t: 'DL' });
    else if (m[1] !== undefined) tokens.push({ t: 'H3', name: stripHtml(m[1]) });
    else tokens.push({ t: 'A', href: attr(m[2], 'href') ?? '', title: stripHtml(m[3]) });
  }

  const ROOT = -1; // 栈底哨兵，表示根层级
  const stack: number[] = [ROOT]; // 栈中存放 groups 数组下标，ROOT 表示根
  const groups: ParsedBookmarkGroup[] = [];
  let defaultIdx = -1;

  const currentIdx = (): number => {
    const top = stack[stack.length - 1];
    if (top === ROOT) {
      if (defaultIdx === -1) {
        groups.push({ name: '浏览器书签', items: [] });
        defaultIdx = groups.length - 1;
      }
      return defaultIdx;
    }
    return top;
  };

  for (const tk of tokens) {
    if (tk.t === 'H3') {
      groups.push({ name: tk.name || '未命名分组', items: [] });
      stack.push(groups.length - 1);
    } else if (tk.t === '/DL') {
      if (stack.length > 1) stack.pop();
    } else if (tk.t === 'A') {
      if (!tk.href) continue;
      groups[currentIdx()].items.push({ title: tk.title || tk.href, url: tk.href, desc: '' });
    }
    // <DL> 作为容器标记无需处理：H3 已入栈，/DL 出栈
  }

  return groups.filter((g) => g.items.length > 0);
}

/** 解析书签 HTML 并写入数据库（mode=replace 时先清空现有分组） */
export function importBookmarks(
  userId: number,
  html: string,
  mode: 'replace' | 'append',
): { groupCount: number; itemCount: number } {
  const parsed = parseBookmarks(html);
  if (mode === 'replace') {
    for (const g of listGroups(userId)) deleteGroup(userId, g.id);
  }
  let groupCount = 0;
  let itemCount = 0;
  for (const g of parsed) {
    const group = createGroup(userId, g.name, null);
    groupCount += 1;
    for (const item of g.items) {
      createItem(userId, {
        groupId: group.id,
        title: item.title,
        icon: null,
        urlLan: item.url,
        urlWan: item.url,
        desc: item.desc ?? '',
        openMode: 'blank' as OpenMode,
        color: null,
      });
      itemCount += 1;
    }
  }
  return { groupCount, itemCount };
}
