import type { Group, Item, ItemService, OpenMode, Role, Settings, UploadedFile, User } from './types';
// 仅类型导入，避免把服务端模块打进前端包
import type { ProbeResult as ServiceProbe, ServiceTemplate as ServiceTemplateOption } from './serviceWidgets';

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
  });
  const text = await res.text();
  let data: unknown = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  if (!res.ok) {
    const message =
      data && typeof data === 'object' && 'error' in data
        ? String((data as { error: string }).error)
        : `请求失败 (${res.status})`;
    throw new Error(message);
  }
  return data as T;
}

const asQuery = (as?: number | null) => (as ? `?as=${as}` : '');

export type GroupWithItems = Group & { items: Item[] };

export interface SystemStatus {
  version: string;
  service: {
    pid: number;
    uptime: number;
    nodeVersion: string;
    rssMb: number;
    heapUsedMb: number;
  };
  host: {
    hostname: string;
    platform: string;
    arch: string;
    cpuModel: string;
    cpuCount: number;
    loadAvg: number[];
    totalMemGb: number;
    freeMemGb: number;
    osUptime: number;
  };
  data: {
    dataDir: string;
    dbSizeMb: number;
    groups: number;
    items: number;
    files: number;
    users: number;
  };
}

export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  created: number;
  ports: Array<{ private: number; public?: number; type: string }>;
}

export interface DockerListResult {
  available: boolean;
  socket: string;
  message?: string;
  containers: DockerContainer[];
  info?: { version?: string; containers: number; running: number; stopped: number } | null;
}

export interface MetricPoint {
  t: number;
  cpu: number;
  mem: number;
  disk: number;
  netRx: number;
  netTx: number;
}

export interface MetricsResult {
  current: MetricPoint;
  history: MetricPoint[];
  disk: { path: string; totalGb: number; usedGb: number; freeGb: number; usedPercent: number };
  memory: { totalGb: number; usedGb: number; freeGb: number; usedPercent: number };
  cpu: { count: number; model: string; loadAvg: number[] };
  osUptime: number;
}

export interface MetricAlert {
  id: number;
  t: number;
  kind: 'cpu' | 'mem' | 'disk';
  value: number;
  threshold: number;
  ack: number;
  ackT: number | null;
}

export interface MetricsHistoryResult {
  range: string;
  total: number;
  items: MetricPoint[];
}

export const api = {
  login: (username: string, password: string) =>
    request<User>('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) }),

  logout: () => request<{ success: boolean }>('/api/auth/logout', { method: 'POST' }),

  me: () => request<{ user: User | null; guestId: number | null; settings: Settings; users: User[] }>('/api/auth/me'),

  changePassword: (oldPassword: string, newPassword: string) =>
    request<{ success: boolean }>('/api/auth/password', {
      method: 'POST',
      body: JSON.stringify({ oldPassword, newPassword }),
    }),

  groups: (as?: number | null) => request<GroupWithItems[]>(`/api/groups${asQuery(as)}`),

  createGroup: (name: string, icon: string | null, as?: number | null) =>
    request<Group>(`/api/groups${asQuery(as)}`, { method: 'POST', body: JSON.stringify({ name, icon }) }),

  updateGroup: (id: number, patch: { name?: string; icon?: string | null; sort?: number }, as?: number | null) =>
    request<Group>(`/api/groups/${id}${asQuery(as)}`, { method: 'PATCH', body: JSON.stringify(patch) }),

  deleteGroup: (id: number, as?: number | null) =>
    request<{ success: boolean }>(`/api/groups/${id}${asQuery(as)}`, { method: 'DELETE' }),

  reorderGroups: (ids: number[], as?: number | null) =>
    request<{ success: boolean }>(`/api/groups/reorder${asQuery(as)}`, {
      method: 'POST',
      body: JSON.stringify({ ids }),
    }),

  createItem: (
    input: {
      groupId: number;
      title: string;
      icon?: string | null;
      urlLan?: string;
      urlWan?: string;
      desc?: string;
      openMode?: OpenMode;
      color?: string | null;
      service?: string | null;
      container?: string | null;
    },
    as?: number | null,
  ) => request<Item>(`/api/items${asQuery(as)}`, { method: 'POST', body: JSON.stringify(input) }),

  updateItem: (
    id: number,
    patch: Partial<
      Pick<
        Item,
        | 'title'
        | 'icon'
        | 'urlLan'
        | 'urlWan'
        | 'desc'
        | 'openMode'
        | 'color'
        | 'sort'
        | 'groupId'
        | 'service'
        | 'container'
      >
    >,
    as?: number | null,
  ) => request<Item>(`/api/items/${id}${asQuery(as)}`, { method: 'PATCH', body: JSON.stringify(patch) }),

  deleteItem: (id: number, as?: number | null) =>
    request<{ success: boolean }>(`/api/items/${id}${asQuery(as)}`, { method: 'DELETE' }),

  reorderItems: (groupId: number, ids: number[], as?: number | null) =>
    request<{ success: boolean }>(`/api/items/reorder${asQuery(as)}`, {
      method: 'POST',
      body: JSON.stringify({ ids, groupId }),
    }),

  settings: (as?: number | null, global = false) =>
    request<Settings>(`/api/settings${asQuery(as)}${global ? (as ? '&' : '?') + 'global=1' : ''}`),

  saveSettings: (patch: Partial<Settings>, as?: number | null, global = false) =>
    request<Settings>(`/api/settings${asQuery(as)}${global ? (as ? '&' : '?') + 'global=1' : ''}`, {
      method: 'PUT',
      body: JSON.stringify(patch),
    }),

  resetSettings: (as?: number | null) =>
    request<Settings>(`/api/settings/reset${asQuery(as)}`, { method: 'POST' }),

  system: () => request<SystemStatus>('/api/system'),

  metrics: () => request<MetricsResult>('/api/metrics'),

  metricsHistory: (range: string) =>
    request<MetricsHistoryResult>(`/api/metrics/history?range=${encodeURIComponent(range)}`),

  metricsAlerts: (limit = 50, onlyUnack = false) =>
    request<{ items: MetricAlert[]; unack: number }>(
      `/api/metrics/alerts?limit=${limit}${onlyUnack ? '&unack=1' : ''}`,
    ),

  ackAlert: (id?: number) =>
    request<{ changed: number; unack: number }>('/api/metrics/alerts', {
      method: 'POST',
      body: JSON.stringify(id === undefined ? { all: true } : { id }),
    }),

  dockerContainers: () => request<DockerListResult>('/api/docker/containers'),

  /** 管理员自助诊断：用当前全局配置测试能否拉到 IdP 元数据（discovery） */
  oidcTest: () =>
    request<{
      ok: boolean;
      message: string;
      ms?: number;
      issuer?: string;
      authorizationEndpoint?: string;
      tokenEndpoint?: string;
      warning?: string;
    }>('/api/auth/oidc/test', { method: 'POST' }),

  dockerAction: (id: string, action: 'start' | 'stop' | 'restart') =>
    request<{ success: boolean }>(`/api/docker/containers/${id}/action`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    }),

  dockerLogs: (id: string, tail = 200) =>
    request<{ logs: string }>(`/api/docker/containers/${id}/logs?tail=${tail}`),

  users: () => request<User[]>('/api/users'),

  createUser: (username: string, password: string, role: Role) =>
    request<User>('/api/users', { method: 'POST', body: JSON.stringify({ username, password, role }) }),

  updateUser: (id: number, patch: { username?: string; password?: string; role?: Role }) =>
    request<User>(`/api/users/${id}`, { method: 'PATCH', body: JSON.stringify(patch) }),

  deleteUser: (id: number) => request<{ success: boolean }>(`/api/users/${id}`, { method: 'DELETE' }),

  uploadFile: async (file: File, as?: number | null) => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`/api/upload${asQuery(as)}`, { method: 'POST', body: form });
    if (!res.ok) throw new Error('上传失败');
    return (await res.json()) as UploadedFile & { dedup: boolean };
  },

  listFiles: (as?: number | null) => request<UploadedFile[]>(`/api/upload${asQuery(as)}`),

  deleteFile: (id: number, as?: number | null) =>
    request<{ success: boolean }>(`/api/upload${asQuery(as)}${as ? '&' : '?'}id=${id}`, { method: 'DELETE' }),

  importData: (payload: unknown, mode: 'replace' | 'append', as?: number | null) =>
    request<{ success: boolean; groupCount: number; itemCount: number }>(`/api/import${asQuery(as)}`, {
      method: 'POST',
      body: JSON.stringify({ payload, mode }),
    }),

  importBookmarks: async (file: File, mode: 'replace' | 'append', as?: number | null) => {
    const form = new FormData();
    form.append('file', file);
    form.append('mode', mode);
    const res = await fetch(`/api/import/bookmarks${asQuery(as)}`, { method: 'POST', body: form });
    if (!res.ok) {
      let msg = `请求失败 (${res.status})`;
      try {
        const d = await res.json();
        if (d && d.error) msg = d.error;
      } catch {
        /* 忽略 */
      }
      throw new Error(msg);
    }
    return (await res.json()) as { success: boolean; groupCount: number; itemCount: number };
  },

  importSunPanel: async (file: File, mode: 'replace' | 'append', as?: number | null) => {
    const form = new FormData();
    form.append('file', file);
    form.append('mode', mode);
    const res = await fetch(`/api/import/sun-panel${asQuery(as)}`, { method: 'POST', body: form });
    if (!res.ok) {
      let msg = `请求失败 (${res.status})`;
      try {
        const d = await res.json();
        if (d && d.error) msg = d.error;
      } catch {
        /* 忽略 */
      }
      throw new Error(msg);
    }
    return (await res.json()) as {
      success: boolean;
      groupCount: number;
      itemCount: number;
      iconCount: number;
    };
  },

  backupList: () => request<{ backups: Array<{ name: string; size: number; createdAt: number }> }>('/api/backup'),

  backupNow: () =>
    request<{ backup: { name: string; size: number; createdAt: number } }>('/api/backup', { method: 'POST' }),

  backupDelete: (name: string) =>
    request<{ success: boolean }>('/api/backup', { method: 'DELETE', body: JSON.stringify({ name }) }),

  backupRestore: (name: string) =>
    request<{ success: boolean }>('/api/backup/restore', { method: 'POST', body: JSON.stringify({ name }) }),

  serviceTemplates: () => request<{ templates: ServiceTemplateOption[] }>('/api/services/templates'),

  serviceTest: (config: ItemService) =>
    request<ServiceProbe>('/api/services/test', { method: 'POST', body: JSON.stringify({ config }) }),

  serviceStatus: () => request<{ status: Record<string, ServiceProbe> }>('/api/services/status'),
};
