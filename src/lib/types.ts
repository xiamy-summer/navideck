export type Role = 'admin' | 'user' | 'guest';

export interface User {
  id: number;
  username: string;
  role: Role;
  avatar: string | null;
  createdAt: number;
}

export interface UserRow extends User {
  passwordHash: string;
  tokenVersion?: number;
}

export interface Group {
  id: number;
  userId: number;
  name: string;
  icon: string | null;
  sort: number;
  createdAt: number;
}

/** 打开方式：新标签页 / 当前页 / 内置小窗口 */
export type OpenMode = 'blank' | 'self' | 'modal';

export interface Item {
  id: number;
  groupId: number;
  userId: number;
  title: string;
  icon: string | null;
  urlLan: string;
  urlWan: string;
  desc: string | null;
  openMode: OpenMode;
  color: string | null;
  sort: number;
  createdAt: number;
}

export interface SearchEngine {
  id: string;
  name: string;
  url: string;
  icon: string;
}

export type ThemeMode = 'auto' | 'light' | 'dark';
export type NetMode = 'lan' | 'wan';

export interface Settings {
  siteTitle: string;
  lang: string;
  theme: ThemeMode;
  accent: string;
  bgImage: string;
  netMode: NetMode;

  columns: number;
  cardRadius: number;
  cardOpacity: number;
  showDesc: boolean;
  iconSize: number;

  searchEnabled: boolean;
  searchPlaceholder: string;
  searchEngine: string;
  searchEngines: SearchEngine[];
  searchBg: string;
  searchText: string;
  searchRadius: number;
  searchWidth: number;

  footerEnabled: boolean;
  footerText: string;

  customCss: string;
  customJs: string;

  dockerEnabled: boolean;
  /** 是否允许未登录访客浏览访客账号的内容 */
  guestEnabled: boolean;

  /** 首页信息小组件 */
  widgetsEnabled: boolean;
  widgetPosition: 'top' | 'bottom';
  widgetSystem: boolean;
  widgetDocker: boolean;
  widgetRefresh: number;
}

export const DEFAULT_SETTINGS: Settings = {
  siteTitle: 'NaviDeck',
  lang: 'zh-CN',
  theme: 'auto',
  accent: '#3b82f6',
  bgImage: '',
  netMode: 'lan',

  columns: 6,
  cardRadius: 14,
  cardOpacity: 100,
  showDesc: true,
  iconSize: 34,

  searchEnabled: true,
  searchPlaceholder: '搜索…',
  searchEngine: 'baidu',
  searchEngines: [
    { id: 'baidu', name: '百度', url: 'https://www.baidu.com/s?wd={q}', icon: 'simple-icons:baidu' },
    { id: 'bing', name: 'Bing', url: 'https://www.bing.com/search?q={q}', icon: 'logos:bing' },
    { id: 'google', name: 'Google', url: 'https://www.google.com/search?q={q}', icon: 'logos:google-icon' },
    { id: 'duckduckgo', name: 'DuckDuckGo', url: 'https://duckduckgo.com/?q={q}', icon: 'simple-icons:duckduckgo' },
  ],
  searchBg: '',
  searchText: '',
  searchRadius: 999,
  searchWidth: 520,

  footerEnabled: false,
  footerText: '',

  customCss: '',
  customJs: '',

  dockerEnabled: true,
  guestEnabled: true,

  widgetsEnabled: true,
  widgetPosition: 'top',
  widgetSystem: true,
  widgetDocker: true,
  widgetRefresh: 10,
};

export interface UploadedFile {
  id: number;
  userId: number;
  hash: string;
  name: string;
  mime: string;
  size: number;
  path: string;
  refCount: number;
  createdAt: number;
}

export interface BackupItem {
  title?: string;
  icon?: string | null;
  urlLan?: string;
  urlWan?: string;
  desc?: string | null;
  openMode?: OpenMode;
  color?: string | null;
  sort?: number;
}

export interface BackupGroup {
  name?: string;
  icon?: string | null;
  sort?: number;
  items?: BackupItem[];
}

/** 导出/导入的完整数据包 */
export interface BackupPayload {
  version: number;
  exportedAt: number;
  settings?: Partial<Settings>;
  groups: BackupGroup[];
}
