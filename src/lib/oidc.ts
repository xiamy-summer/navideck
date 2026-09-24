import crypto from 'node:crypto';
import { jwtVerify, createRemoteJWKSet, type JWTPayload } from 'jose';
import { getGlobalSettings } from '@/lib/db';
import type { Settings } from './types';

export interface OidcConfig {
  enabled: boolean;
  issuer: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  scopes: string;
  defaultRole: 'user' | 'admin';
  adminClaim: string;
  adminValue: string;
  buttonLabel: string;
}

// 缓存必须绑定 issuer：否则管理员改了 Issuer 后会在一小时内继续命中旧文档，排查时极易误判
let cachedDiscovery: { ts: number; issuer: string; doc: Record<string, unknown> } | null = null;

/**
 * 读取并校验 OIDC 配置；未启用或缺失关键项时返回 null。
 * 取值顺序：全局设置（数据库）优先，字段留空才回落到同名环境变量，
 * 这样纯 docker-compose 部署的老配置不会失效。
 */
export function getOidcConfig(overrideRedirectUri?: string): OidcConfig | null {
  let s: Settings | null = null;
  try {
    s = getGlobalSettings();
  } catch {
    s = null;
  }

  const issuer = (s?.oidcIssuer || process.env.OIDC_ISSUER || '').replace(/\/$/, '');
  const clientId = s?.oidcClientId || process.env.OIDC_CLIENT_ID || '';
  const clientSecret = s?.oidcClientSecret || process.env.OIDC_CLIENT_SECRET || '';

  // 数据库里已填写 issuer 或 clientId 时，以数据库开关为准；否则沿用环境变量开关
  const configuredInDb = Boolean(s?.oidcIssuer || s?.oidcClientId);
  const enabled = configuredInDb
    ? Boolean(s?.oidcEnabled)
    : Boolean(s?.oidcEnabled) || process.env.OIDC_ENABLED === 'true';

  if (!enabled || !issuer || !clientId) return null;

  return {
    enabled: true,
    issuer,
    clientId,
    clientSecret,
    redirectUri: overrideRedirectUri || s?.oidcRedirectUri || process.env.OIDC_REDIRECT_URI || '',
    scopes: s?.oidcScopes || process.env.OIDC_SCOPES || 'openid email profile',
    defaultRole: (s?.oidcDefaultRole || process.env.OIDC_DEFAULT_ROLE) === 'admin' ? 'admin' : 'user',
    adminClaim: s?.oidcAdminClaim || process.env.OIDC_ADMIN_CLAIM || '',
    adminValue: s?.oidcAdminValue || process.env.OIDC_ADMIN_VALUE || '',
    buttonLabel: s?.oidcButtonLabel || process.env.OIDC_BUTTON_LABEL || '',
  };
}

/** 获取 OIDC discovery 文档（带 1 小时缓存） */
export async function discover(issuer: string): Promise<Record<string, unknown>> {
  if (cachedDiscovery && cachedDiscovery.issuer === issuer && cachedDiscovery.ts > Date.now() - 3600_000) {
    return cachedDiscovery.doc;
  }
  const url = `${issuer}/.well-known/openid-configuration`;

  let res: Response;
  try {
    res = await fetch(url, { headers: { Accept: 'application/json' } });
  } catch (e) {
    // 常见于：issuer 填错 / 容器内 DNS 解析不了 / 自签证书不被信任
    throw new Error(
      `无法连接 OIDC 服务 ${url}（${e instanceof Error ? e.message : '网络错误'}）。请检查 Issuer 是否正确、以及本机能否访问该地址`,
    );
  }
  if (!res.ok) {
    throw new Error(`获取 OIDC 发现文档失败：${url} 返回 HTTP ${res.status}。请确认 Issuer 填写的是 realm / 应用根地址，而不是 discovery 地址本身`);
  }

  const doc = (await res.json()) as Record<string, unknown>;
  const missing = ['authorization_endpoint', 'token_endpoint', 'jwks_uri'].filter((k) => !doc[k]);
  if (missing.length) {
    throw new Error(`OIDC 发现文档缺少必需字段：${missing.join('、')}`);
  }

  cachedDiscovery = { ts: Date.now(), issuer, doc };
  return doc;
}

export function genPkce(): { verifier: string; challenge: string } {
  const verifier = crypto.randomBytes(32).toString('base64url');
  const challenge = crypto.createHash('sha256').update(verifier).digest('base64url');
  return { verifier, challenge };
}

export function genRandom(len = 24): string {
  return crypto.randomBytes(len).toString('base64url');
}

/** 构造授权 URL */
export async function buildAuthorizeUrl(cfg: OidcConfig, opts: { state: string; nonce: string; codeChallenge: string }): Promise<string> {
  const doc = await discover(cfg.issuer);
  const authz = String(doc.authorization_endpoint);
  const params = new URLSearchParams({
    response_type: 'code',
    client_id: cfg.clientId,
    redirect_uri: cfg.redirectUri,
    scope: cfg.scopes,
    state: opts.state,
    nonce: opts.nonce,
    code_challenge: opts.codeChallenge,
    code_challenge_method: 'S256',
  });
  return `${authz}?${params.toString()}`;
}

export interface OidcClaims {
  username: string;
  name: string;
  role: 'user' | 'admin';
}

/** 用 ID Token 的 claims 推导本地用户名与角色 */
export function resolveClaims(payload: JWTPayload, cfg: OidcConfig): OidcClaims {
  const email = (payload.email as string) || '';
  const preferred = (payload.preferred_username as string) || '';
  const sub = String(payload.sub || '');
  const username = email || preferred || sub;
  let role = cfg.defaultRole;
  if (cfg.adminClaim && cfg.adminValue) {
    const claimVal = payload[cfg.adminClaim];
    const isAdmin = Array.isArray(claimVal)
      ? claimVal.map(String).includes(cfg.adminValue)
      : String(claimVal) === cfg.adminValue;
    if (isAdmin) role = 'admin';
  }
  return { username, name: (payload.name as string) || username, role };
}

/** 交换授权码并验证 ID Token，返回 claims */
export async function exchangeAndVerify(
  cfg: OidcConfig,
  code: string,
  codeVerifier: string,
  nonce: string,
): Promise<OidcClaims> {
  const doc = await discover(cfg.issuer);
  const tokenEndpoint = String(doc.token_endpoint);
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: cfg.redirectUri,
    client_id: cfg.clientId,
    client_secret: cfg.clientSecret,
    code_verifier: codeVerifier,
  });
  const res = await fetch(tokenEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
    body,
  });
  if (!res.ok) throw new Error('令牌交换失败');
  const tokens = (await res.json()) as { id_token?: string };
  if (!tokens.id_token) throw new Error('未返回 ID Token');

  const jwksUri = String(doc.jwks_uri);
  const keySet = createRemoteJWKSet(new URL(jwksUri));
  const { payload } = await jwtVerify(tokens.id_token, keySet, {
    issuer: cfg.issuer,
    audience: cfg.clientId,
  });
  if (payload.nonce !== nonce) throw new Error('nonce 校验失败');
  return resolveClaims(payload, cfg);
}
