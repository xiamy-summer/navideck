import type { ItemService } from './types';

export interface ServiceField {
  label: string;
  /** JSON 取值路径，支持 a.b.0.c 与数组 length */
  path: string;
  /** 字段图标（Iconify 名），Homepage 风格每字段一图标 */
  icon?: string;
  suffix?: string;
  /** 数值乘数，用于单位换算（如字节/秒转 MB/s 填 1/1048576） */
  scale?: number;
  digits?: number;
  /** 是否渲染为进度条（数值按 0-100 百分比） */
  bar?: boolean;
}

export interface ServiceEndpoint {
  path: string;
  method?: string;
  body?: string;
  fields: ServiceField[];
}

export type AuthStyle =
  | 'none'
  | 'header'
  | 'bearer'
  | 'basic'
  | 'query'
  | 'plex'
  | 'emby'
  | 'proxmox'
  | 'portainer'
  | 'qbittorrent'
  | 'transmission';

export interface ServiceTemplate {
  id: string;
  name: string;
  auth: AuthStyle;
  /** header 模式下的请求头名 */
  keyHeader?: string;
  /** query 模式下的参数名 */
  keyQuery?: string;
  /** 密钥输入框的提示文案 */
  keyHint?: string;
  needsKey: boolean;
  endpoints: ServiceEndpoint[];
}

/** 从第 3 版起统一的字段：类型下可选{key}占位，会被替换成用户填写的密钥或 slug */
export const TEMPLATES: ServiceTemplate[] = [
  /* ------------------------------ 影音下载 ------------------------------ */
  {
    id: 'sonarr',
    name: 'Sonarr',
    auth: 'header',
    keyHeader: 'X-Api-Key',
    keyHint: 'Settings → General → API Key',
    needsKey: true,
    endpoints: [
      { path: '/api/v3/series', fields: [{ label: 'series', path: 'length', icon: 'mdi:television-play' }] },
      { path: '/api/v3/wanted/missing?pageSize=1', fields: [{ label: 'missing', path: 'totalRecords', icon: 'mdi:alert-circle-outline' }] },
      { path: '/api/v3/queue?pageSize=1', fields: [{ label: 'queued', path: 'totalRecords', icon: 'mdi:download-circle-outline' }] },
    ],
  },
  {
    id: 'radarr',
    name: 'Radarr',
    auth: 'header',
    keyHeader: 'X-Api-Key',
    keyHint: 'Settings → General → API Key',
    needsKey: true,
    endpoints: [
      { path: '/api/v3/movie', fields: [{ label: 'movies', path: 'length', icon: 'mdi:movie-open-outline' }] },
      { path: '/api/v3/wanted/missing?pageSize=1', fields: [{ label: 'missing', path: 'totalRecords', icon: 'mdi:alert-circle-outline' }] },
      { path: '/api/v3/queue?pageSize=1', fields: [{ label: 'queued', path: 'totalRecords', icon: 'mdi:download-circle-outline' }] },
    ],
  },
  {
    id: 'lidarr',
    name: 'Lidarr',
    auth: 'header',
    keyHeader: 'X-Api-Key',
    keyHint: 'Settings → General → API Key',
    needsKey: true,
    endpoints: [
      { path: '/api/v1/artist', fields: [{ label: 'artists', path: 'length', icon: 'mdi:account-music-outline' }] },
      { path: '/api/v1/wanted/missing?pageSize=1', fields: [{ label: 'missing', path: 'totalRecords', icon: 'mdi:alert-circle-outline' }] },
    ],
  },
  {
    id: 'bazarr',
    name: 'Bazarr',
    auth: 'header',
    keyHeader: 'X-API-KEY',
    keyHint: 'Settings → General → API Key',
    needsKey: true,
    endpoints: [
      { path: '/api/series', fields: [{ label: 'series', path: 'length', icon: 'mdi:television-play' }] },
      { path: '/api/movies', fields: [{ label: 'movies', path: 'length', icon: 'mdi:movie-open-outline' }] },
    ],
  },
  {
    id: 'qbittorrent',
    name: 'qBittorrent',
    auth: 'qbittorrent',
    keyHint: 'WebUI 用户名:密码，如 admin:123456',
    needsKey: true,
    endpoints: [
      { path: '/api/v2/torrents/info', fields: [{ label: 'torrents', path: 'length', icon: 'mdi:download-multiple-outline' }] },
      {
        path: '/api/v2/transfer/info',
        fields: [
          { label: 'dl', path: 'dl_info_speed', scale: 1 / 1048576, digits: 1, suffix: ' MB/s', icon: 'mdi:arrow-down-bold' },
          { label: 'up', path: 'up_info_speed', scale: 1 / 1048576, digits: 1, suffix: ' MB/s', icon: 'mdi:arrow-up-bold' },
        ],
      },
    ],
  },
  {
    id: 'transmission',
    name: 'Transmission',
    auth: 'transmission',
    keyHint: 'RPC 用户名:密码（无认证可留空）',
    needsKey: false,
    endpoints: [
      {
        path: '/transmission/rpc',
        method: 'POST',
        body: '{"method":"session-stats"}',
        fields: [
          { label: 'torrents', path: 'arguments.torrentCount', icon: 'mdi:download-multiple-outline' },
          {
            label: 'dl',
            path: 'arguments.downloadSpeed',
            scale: 1 / 1024,
            digits: 0,
            suffix: ' KB/s',
          },
        ],
      },
    ],
  },
  {
    id: 'plex',
    name: 'Plex',
    auth: 'plex',
    keyHint: 'X-Plex-Token，可在媒体项 XML 链接中找到',
    needsKey: true,
    endpoints: [
      { path: '/library/sections', fields: [{ label: 'libraries', path: 'MediaContainer.size', icon: 'mdi:folder-multiple-outline' }] },
      { path: '/status/sessions', fields: [{ label: 'playing', path: 'MediaContainer.size', icon: 'mdi:play-circle-outline' }] },
    ],
  },
  {
    id: 'jellyfin',
    name: 'Jellyfin',
    auth: 'emby',
    keyHint: 'Dashboard → API Keys',
    needsKey: true,
    endpoints: [
      {
        path: '/Items?Recursive=true&Limit=1',
        fields: [{ label: 'items', path: 'TotalRecordCount', icon: 'mdi:movie-open-outline' }],
      },
      { path: '/Sessions', fields: [{ label: 'playing', path: 'length', icon: 'mdi:play-circle-outline' }] },
    ],
  },
  {
    id: 'emby',
    name: 'Emby',
    auth: 'query',
    keyQuery: 'api_key',
    keyHint: 'Dashboard → API Keys',
    needsKey: true,
    endpoints: [
      {
        path: '/emby/Items?Recursive=true&Limit=1',
        fields: [{ label: 'items', path: 'TotalRecordCount', icon: 'mdi:movie-open-outline' }],
      },
      { path: '/emby/Sessions', fields: [{ label: 'playing', path: 'length', icon: 'mdi:play-circle-outline' }] },
    ],
  },

  /* ------------------------------ 系统与容器 ------------------------------ */
  {
    id: 'portainer',
    name: 'Portainer',
    auth: 'portainer',
    keyHint: 'My Account → Access tokens',
    needsKey: true,
    endpoints: [{ path: '/api/endpoints', fields: [{ label: 'endpoints', path: 'length', icon: 'mdi:server-outline' }] }],
  },
  {
    id: 'proxmox',
    name: 'Proxmox VE',
    auth: 'proxmox',
    keyHint: 'API Token，形如 user@pam!name=uuid-secret',
    needsKey: true,
    endpoints: [
      { path: '/api2/json/nodes', fields: [{ label: 'nodes', path: 'data.length', icon: 'mdi:server-network' }] },
      { path: '/api2/json/cluster/resources?type=vm', fields: [{ label: 'guests', path: 'data.length', icon: 'mdi:desktop-classic' }] },
    ],
  },
  {
    id: 'uptimekuma',
    name: 'Uptime Kuma',
    auth: 'none',
    keyHint: '公开状态页 slug（无需密钥）',
    needsKey: true,
    endpoints: [
      {
        path: '/api/status-page/heartbeat/{key}',
        fields: [{ label: 'uptime24h', path: 'uptimeList.86400', digits: 2, suffix: '%', icon: 'mdi:chart-timeline-variant', bar: true }],
      },
    ],
  },
  {
    id: 'scrutiny',
    name: 'Scrutiny',
    auth: 'none',
    keyHint: '无需密钥（无鉴权部署）',
    needsKey: false,
    endpoints: [
      { path: '/api/summary', fields: [{ label: 'passed', path: 'data.summary.passed', icon: 'mdi:check-circle-outline' }] },
      { path: '/api/summary', fields: [{ label: 'failed', path: 'data.summary.failed', icon: 'mdi:close-circle-outline' }] },
    ],
  },
  {
    id: 'glances',
    name: 'Glances',
    auth: 'none',
    keyHint: '无需密钥（无鉴权部署）',
    needsKey: false,
    endpoints: [
      { path: '/api/3/cpu', fields: [{ label: 'cpu', path: 'total', digits: 0, suffix: '%', icon: 'mdi:cpu-64-bit', bar: true }] },
      { path: '/api/3/mem', fields: [{ label: 'mem', path: 'percent', digits: 0, suffix: '%', icon: 'mdi:memory', bar: true }] },
    ],
  },
];

export function listTemplates(): ServiceTemplate[] {
  return TEMPLATES;
}

export function getTemplate(id: string): ServiceTemplate | undefined {
  return TEMPLATES.find((tmpl) => tmpl.id === id);
}

/** 按 a.b.0.c 形式取值；数组上取 length 返回其长度 */
export function pick(obj: unknown, path: string): unknown {
  const segs = path.replace(/^\$/, '').split('.').filter(Boolean);
  let cur: unknown = obj;
  for (const seg of segs) {
    if (cur == null) return undefined;
    if (seg === 'length' && Array.isArray(cur)) return cur.length;
    if (Array.isArray(cur)) {
      const idx = Number(seg);
      cur = Number.isNaN(idx) ? undefined : cur[idx];
    } else if (typeof cur === 'object') {
      cur = (cur as Record<string, unknown>)[seg];
    } else {
      return undefined;
    }
  }
  return cur;
}

function fmtValue(value: unknown, field: ServiceField): { text: string; raw?: number } {
  if (value === undefined || value === null || value === '') return { text: '-' };
  const numeric = typeof value === 'number' ? value : Number(value);
  const isNum = typeof numeric === 'number' && Number.isFinite(numeric);
  if (isNum && typeof field.scale === 'number') {
    const scaled = numeric * field.scale;
    const digits = field.digits ?? (Math.abs(scaled) >= 100 ? 0 : 1);
    return { text: `${fmtInt(scaled, digits)}${field.suffix ?? ''}`, raw: scaled };
  }
  if (isNum && field.digits !== undefined) {
    return { text: `${fmtInt(numeric, field.digits)}${field.suffix ?? ''}`, raw: numeric };
  }
  if (isNum) {
    return { text: `${fmtInt(numeric, Math.abs(numeric) >= 100 ? 0 : 1)}${field.suffix ?? ''}`, raw: numeric };
  }
  return { text: `${value}${field.suffix ?? ''}` };
}

/** 千分位 + 小数位数（Homepage 风格的紧凑数字） */
function fmtInt(n: number, digits: number): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: digits });
}

export interface ProbeField {
  label: string;
  value: string;
  /** 字段图标（模板 icon 或自定义 API 无则空） */
  icon?: string;
  /** 原始数值（供进度条渲染） */
  raw?: number;
  /** 是否进度条 */
  bar?: boolean;
}

export interface ProbeResult {
  ok: boolean;
  fields: ProbeField[];
  message?: string;
}

const TIMEOUT_MS = 8000;
const CACHE_TTL_MS = 60_000;

type CacheEntry = { ts: number; result: ProbeResult };
const g = globalThis as unknown as { __navServiceCache?: Map<string, CacheEntry> };
function cacheStore(): Map<string, CacheEntry> {
  if (!g.__navServiceCache) g.__navServiceCache = new Map();
  return g.__navServiceCache;
}

function buildHeaders(tmpl: ServiceTemplate | null, cfg: ItemService): Record<string, string> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const key = cfg.key ?? '';
  if (!tmpl) {
    for (const h of cfg.custom?.headers ?? []) {
      if (h.name) headers[h.name] = h.value;
    }
    return headers;
  }
  switch (tmpl.auth) {
    case 'header':
      if (tmpl.keyHeader) headers[tmpl.keyHeader] = key;
      break;
    case 'bearer':
      headers.Authorization = `Bearer ${key}`;
      break;
    case 'basic':
      headers.Authorization = `Basic ${Buffer.from(key).toString('base64')}`;
      break;
    case 'emby':
      headers['X-Emby-Token'] = key;
      headers.Authorization = `MediaBrowser Token="${key}"`;
      break;
    case 'proxmox':
      headers.Authorization = `PVEAPIToken=${key}`;
      break;
    case 'portainer':
      headers['X-API-Key'] = key;
      break;
    default:
      break;
  }
  return headers;
}

function buildUrl(base: string, path: string, tmpl: ServiceTemplate | null, cfg: ItemService): string {
  const root = base.replace(/\/+$/, '');
  let resolved = path.replace('{key}', encodeURIComponent(cfg.key ?? ''));
  let url = `${root}${resolved.startsWith('/') ? resolved : `/${resolved}`}`;
  if (tmpl && tmpl.auth === 'query' && tmpl.keyQuery) {
    url += `${url.includes('?') ? '&' : '?'}${tmpl.keyQuery}=${encodeURIComponent(cfg.key ?? '')}`;
  }
  if (tmpl && tmpl.auth === 'plex') {
    url += `${url.includes('?') ? '&' : '?'}X-Plex-Token=${encodeURIComponent(cfg.key ?? '')}`;
  }
  return url;
}

/** 单次 HTTP 请求并解析为 JSON */
async function fetchJson(url: string, init: RequestInit): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { ...init, signal: controller.signal, redirect: 'follow' });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const text = await res.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      throw new Error('响应不是 JSON');
    }
  } finally {
    clearTimeout(timer);
  }
}

/** qBittorrent 与 Transmission 需要先取得会话凭据 */
async function resolveSessionCookie(cfg: ItemService, tmpl: ServiceTemplate): Promise<string> {
  const root = cfg.url.replace(/\/+$/, '');
  if (tmpl.auth === 'qbittorrent') {
    const [user, pass] = (cfg.key ?? '').split(':');
    const res = await fetch(`${root}/api/v2/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ username: user ?? '', password: pass ?? '' }),
    });
    const raw = res.headers.get('set-cookie') ?? '';
    return raw.split(/,(?=\s*[^;]+=)/).map((c) => c.split(';')[0].trim()).join('; ');
  }
  if (tmpl.auth === 'transmission') {
    // Transmission 首次请求会返回 409 并带上 Session-Id，这里先换取
    const key = cfg.key ?? '';
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (key.includes(':')) headers.Authorization = `Basic ${Buffer.from(key).toString('base64')}`;
    const probe = await fetch(`${root}/transmission/rpc`, { method: 'POST', headers });
    return probe.headers.get('x-transmission-session-id') ?? '';
  }
  return '';
}

/** 探测单个服务的实时状态 */
export async function probeService(cfg: ItemService, useCache = true): Promise<ProbeResult> {
  const key = `${cfg.type}|${cfg.url}|${cfg.key ?? ''}|${cfg.custom ? JSON.stringify(cfg.custom) : ''}`;
  const ttl = (cfg.cacheSec && cfg.cacheSec > 0 ? cfg.cacheSec : 60) * 1000 || CACHE_TTL_MS;
  if (useCache) {
    const hit = cacheStore().get(key);
    if (hit && Date.now() - hit.ts < ttl) return hit.result;
  }

  const tmpl: ServiceTemplate | null = cfg.type === 'custom' ? null : getTemplate(cfg.type) ?? null;
  if (!tmpl && !cfg.custom) {
    return { ok: false, fields: [], message: '未选择服务模板' };
  }

  let sessionCookie = '';
  let sessionId = '';
  try {
    if (tmpl && (tmpl.auth === 'qbittorrent' || tmpl.auth === 'transmission')) {
      const raw = await resolveSessionCookie(cfg, tmpl);
      if (tmpl.auth === 'qbittorrent') sessionCookie = raw;
      else sessionId = raw;
    }
  } catch {
    // 会话获取失败时不阻断，后续请求会给出明确错误
  }

  const endpoints: ServiceEndpoint[] = tmpl
    ? tmpl.endpoints
    : [
        {
          path: cfg.custom?.path ?? '/',
          method: cfg.custom?.method ?? 'GET',
          body: cfg.custom?.body,
          fields: cfg.custom?.fields ?? [],
        },
      ];

  const fields: ProbeField[] = [];
  const errors: string[] = [];

  const jobs = endpoints.map(async (ep) => {
    const headers = buildHeaders(tmpl, cfg);
    if (sessionCookie) headers.Cookie = sessionCookie;
    if (sessionId) headers['X-Transmission-Session-Id'] = sessionId;
    if (ep.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json';
    try {
      const data = await fetchJson(buildUrl(cfg.url, ep.path, tmpl, cfg), {
        method: ep.method ?? 'GET',
        headers,
        body: ep.body,
      });
      for (const field of ep.fields) {
        const formatted = fmtValue(pick(data, field.path), field);
        fields.push({
          label: field.label,
          value: formatted.text,
          icon: field.icon,
          raw: formatted.raw,
          bar: field.bar,
        });
      }
    } catch (e) {
      for (const field of ep.fields) fields.push({ label: field.label, value: '-', icon: field.icon, bar: field.bar });
      errors.push(e instanceof Error ? e.message : '请求失败');
    }
  });

  await Promise.allSettled(jobs);

  const result: ProbeResult = {
    ok: errors.length === 0,
    fields,
    message: errors.length ? errors[0] : undefined,
  };
  if (result.ok || useCache) cacheStore().set(key, { ts: Date.now(), result });
  return result;
}
