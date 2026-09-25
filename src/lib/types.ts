export type Role = 'admin' | 'user' | 'guest';

export interface User {
  id: number;
  username: string;
  role: Role;
  avatar: string | null;
  createdAt: number;
  /** 1 表示密码过弱（如仍是默认密码），前端应提示立即修改 */
  mustChangePassword?: number;
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
  /** 服务集成配置（ItemService 序列化后的 JSON 字符串），未配置时为 null */
  service?: string | null;
  /** 关联的 Docker 容器名，用于在卡片上显示运行状态 */
  container?: string | null;
  /** 卡片尺寸：sm（1 列小卡）/ md（1 列默认）/ lg（2 列宽卡）；默认 md */
  cardSize?: 'sm' | 'md' | 'lg' | null;
}

/** 站点绑定的服务集成配置，对应 Homepage 的 service widget */
export interface ItemService {
  /** 模板 id；'custom' 表示通用自定义请求 */
  type: string;
  /** 服务根地址，如 http://192.168.1.10:8989 */
  url: string;
  /** API Key / Token，明文存库，对外接口不回显 */
  key: string;
  /** 结果缓存秒数，默认 60 */
  cacheSec?: number;
  /** type 为 custom 时的自定义请求配置 */
  custom?: {
    method: string;
    path: string;
    /** POST/PUT 时的请求体（JSON 字符串） */
    body?: string;
    headers: Array<{ name: string; value: string }>;
    fields: Array<{ label: string; path: string }>;
  };
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
  /** 主题预设 id（theme.ts），应用时覆盖 accent + canvas 亮暗背景 */
  themePreset: string;
  accent: string;
  bgImage: string;
  /** 背景图应用方式：cover（铺满）/ blur（模糊淡入） */
  bgMode: 'cover' | 'blur';
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

  /** 数据自动备份周期（小时），0 表示关闭 */
  backupInterval: number;

  /** 首页信息小组件 */
  widgetsEnabled: boolean;
  widgetPosition: 'top' | 'bottom';
  widgetSystem: boolean;
  widgetDocker: boolean;
  widgetRefresh: number;
  /** 小组件默认大小：sm 紧凑 / md 标准 / lg 占两列（被 widgetSizes 单独覆盖） */
  widgetSize: 'sm' | 'md' | 'lg';
  /** 单个小组件的大小覆盖，键为组件名（system/docker/clock/weather/rss/notes） */
  widgetSizes: Record<string, 'sm' | 'md' | 'lg'>;

  /** 扩展小部件（时钟 / 天气 / RSS / 便签） */
  widgetClock: boolean;
  widgetWeather: boolean;
  widgetWeatherCity: string;
  widgetRss: boolean;
  widgetRssFeeds: string[];
  widgetRssMax: number;
  widgetNotes: boolean;
  widgetNotesText: string;

  /** 监控历史与阈值告警（全局设置，单位见注释） */
  metricRetentionDays: number;
  /** 归档落库间隔（秒） */
  metricArchiveInterval: number;
  metricAlertEnabled: boolean;
  metricAlertCpu: number;
  metricAlertMem: number;
  metricAlertDisk: number;
  /** 同类告警冷却时间（分钟），避免持续超阈值刷屏 */
  metricAlertCooldown: number;

  /** OIDC 单点登录（全局设置；留空字段会回落到同名环境变量） */
  oidcEnabled: boolean;
  oidcIssuer: string;
  oidcClientId: string;
  oidcClientSecret: string;
  /** 留空则自动推导为 <站点地址>/api/auth/oidc/callback */
  oidcRedirectUri: string;
  oidcScopes: string;
  oidcDefaultRole: string;
  oidcAdminClaim: string;
  oidcAdminValue: string;
  /** 登录页按钮文案，留空则使用界面语言的默认文案 */
  oidcButtonLabel: string;
}

export const DEFAULT_SETTINGS: Settings = {
  siteTitle: 'NaviDeck',
  lang: 'zh-CN',
  theme: 'auto',
  accent: '#3b82f6',
  themePreset: 'blue',
  bgImage: '',
  bgMode: 'cover',
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

  backupInterval: 0,

  widgetsEnabled: true,
  widgetPosition: 'top',
  widgetSystem: true,
  widgetDocker: true,
  widgetRefresh: 10,
  widgetSize: 'md',
  widgetSizes: {},

  widgetClock: true,
  widgetWeather: false,
  widgetWeatherCity: '',
  widgetRss: false,
  widgetRssFeeds: [],
  widgetRssMax: 8,
  widgetNotes: false,
  widgetNotesText: '',

  metricRetentionDays: 7,
  metricArchiveInterval: 60,
  metricAlertEnabled: false,
  metricAlertCpu: 90,
  metricAlertMem: 90,
  metricAlertDisk: 90,
  metricAlertCooldown: 30,

  oidcEnabled: false,
  oidcIssuer: '',
  oidcClientId: '',
  oidcClientSecret: '',
  oidcRedirectUri: '',
  oidcScopes: 'openid email profile',
  oidcDefaultRole: '',
  oidcAdminClaim: '',
  oidcAdminValue: '',
  oidcButtonLabel: '',
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
