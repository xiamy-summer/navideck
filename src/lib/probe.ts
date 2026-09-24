/**
 * 站点 HTTP 探活（服务端）。
 *
 * 设计要点：
 * - 只对「未绑定 Docker 容器」的站点探测——绑定容器的站点用容器状态（现有能力），语义不冲突。
 * - HEAD 优先（流量小），405/5xx 方法不支持时回退 GET；状态码 2xx/3xx/401/403 视为在线
 *   （401/403 说明服务活着，只是要登录）。
 * - 内存缓存 60s + 同 key 进行中的探测共享同一个 Promise，防止首页多开标签页时打爆内网服务。
 * - 只探测用户站点列表里的 http/https 地址，不做任意 URL 探测（防 SSRF）。
 */

export interface ProbeState {
  ok: boolean;
  /** 失败原因：timeout / refused / dns / tls / http:<code> / invalid-url */
  reason?: string;
  /** 探测时间戳（ms） */
  at: number;
}

const TTL = 60_000;
const TIMEOUT = 3_000;

const cache = new Map<string, ProbeState>();
const inflight = new Map<string, Promise<ProbeState>>();

export function probeCacheKey(itemId: number, mode: 'lan' | 'wan'): string {
  return `${itemId}:${mode}`;
}

/** 读取缓存（含进行中共享 promise 的复用） */
export function probeSite(itemId: number, mode: 'lan' | 'wan', url: string): Promise<ProbeState> {
  const key = probeCacheKey(itemId, mode);
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < TTL) return Promise.resolve(hit);

  const pending = inflight.get(key);
  if (pending) return pending;

  const task = doProbe(url)
    .then((state) => {
      cache.set(key, state);
      return state;
    })
    .finally(() => {
      inflight.delete(key);
    });
  inflight.set(key, task);
  return task;
}

export async function doProbe(url: string): Promise<ProbeState> {
  if (!/^https?:\/\//i.test(url)) {
    return { ok: false, reason: 'invalid-url', at: Date.now() };
  }
  // 先 HEAD；405/501（方法不允许）等场景回退 GET
  for (const method of ['HEAD', 'GET'] as const) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT);
    try {
      const res = await fetch(url, {
        method,
        redirect: 'follow',
        signal: controller.signal,
        headers: { 'user-agent': 'NaviDeck-Probe/0.15 (+self-hosted health check)' },
        cache: 'no-store',
      });
      clearTimeout(timer);
      // 2xx/3xx 直接在线；401/403/429 也证明服务在响应
      if (res.status < 400 || res.status === 401 || res.status === 403 || res.status === 429) {
        return { ok: true, at: Date.now() };
      }
      // 404/410 等：服务在但路径不对，也算「在线」（导航站常见根路径 404 的反代）
      if (res.status < 500) {
        return { ok: true, reason: `http:${res.status}`, at: Date.now() };
      }
      // 5xx：服务有问题，HEAD 失败可能是应用层误报，回退 GET 再试一次
      if (method === 'HEAD') continue;
      return { ok: false, reason: `http:${res.status}`, at: Date.now() };
    } catch (err) {
      clearTimeout(timer);
      const message = err instanceof Error ? err.message : String(err);
      if (method === 'HEAD') continue; // 回退 GET 重试
      // 分类常见失败原因，前端 title 可读
      let reason = 'error';
      if (message.includes('abort') || message.toLowerCase().includes('timeout')) reason = 'timeout';
      else if (/ECONNREFUSED|connect/i.test(message)) reason = 'refused';
      else if (/ENOTFOUND|getaddrinfo|dns/i.test(message)) reason = 'dns';
      else if (/CERT|SSL|TLS/i.test(message)) reason = 'tls';
      return { ok: false, reason, at: Date.now() };
    }
  }
  return { ok: false, reason: 'error', at: Date.now() };
}
