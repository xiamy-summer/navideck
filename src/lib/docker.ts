import http from 'node:http';
import fs from 'node:fs';

const SOCKET = process.env.DOCKER_SOCKET || '/var/run/docker.sock';

export interface DockerContainer {
  id: string;
  name: string;
  image: string;
  state: string;
  status: string;
  created: number;
  ports: Array<{ private: number; public?: number; type: string }>;
}

export interface DockerInfo {
  version?: string;
  containers: number;
  running: number;
  stopped: number;
  images?: number;
}

export function dockerSocketPath(): string {
  return SOCKET;
}

export function dockerAvailable(): boolean {
  try {
    return fs.existsSync(SOCKET);
  } catch {
    return false;
  }
}

interface RequestOptions {
  method?: string;
  path: string;
  timeout?: number;
}

function request<T>({ method = 'GET', path, timeout = 8000 }: RequestOptions): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { socketPath: SOCKET, path, method, headers: { Host: 'localhost' } },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => {
          body += chunk;
        });
        res.on('end', () => {
          const code = res.statusCode ?? 0;
          if (code >= 400) {
            reject(new Error(`Docker API ${code}: ${body.slice(0, 200)}`));
            return;
          }
          if (!body) {
            resolve(null as unknown as T);
            return;
          }
          try {
            resolve(JSON.parse(body) as T);
          } catch {
            resolve(body as unknown as T);
          }
        });
      },
    );
    req.setTimeout(timeout, () => req.destroy(new Error('Docker API 超时')));
    req.on('error', reject);
    req.end();
  });
}

interface RawContainer {
  Id: string;
  Names?: string[];
  Image: string;
  State: string;
  Status: string;
  Created: number;
  Ports?: Array<{ PrivatePort: number; PublicPort?: number; Type: string }>;
}

export async function listContainers(all = true): Promise<DockerContainer[]> {
  const raw = await request<RawContainer[]>({ path: `/containers/json?all=${all ? 1 : 0}` });
  return (raw ?? []).map((c) => ({
    id: c.Id,
    name: (c.Names?.[0] ?? '').replace(/^\//, '') || c.Id.slice(0, 12),
    image: c.Image,
    state: c.State,
    status: c.Status,
    created: c.Created,
    ports: (c.Ports ?? []).map((p) => ({
      private: p.PrivatePort,
      public: p.PublicPort,
      type: p.Type,
    })),
  }));
}

export async function containerAction(
  id: string,
  action: 'start' | 'stop' | 'restart',
): Promise<void> {
  await request({ method: 'POST', path: `/containers/${encodeURIComponent(id)}/${action}?t=10` });
}

export async function containerLogs(id: string, tail = 200): Promise<string> {
  const raw = await request<string>({
    path: `/containers/${encodeURIComponent(id)}/logs?stdout=1&stderr=1&tail=${tail}`,
    timeout: 10000,
  });
  if (typeof raw !== 'string') return '';
  // Docker 日志流带 8 字节帧头，这里剥掉不可见控制字符
  return raw
    .replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, '')
    .trim();
}

export async function dockerInfo(): Promise<DockerInfo> {
  const [containers, version] = await Promise.all([
    listContainers(true),
    request<{ Version?: string }>({ path: '/version' }).catch(() => null),
  ]);
  const running = containers.filter((c) => c.state === 'running').length;
  return {
    version: version?.Version,
    containers: containers.length,
    running,
    stopped: containers.length - running,
  };
}
