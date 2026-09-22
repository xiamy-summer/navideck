import crypto from 'node:crypto';
import { jwtVerify, createRemoteJWKSet, type JWTPayload } from 'jose';

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

let cachedDiscovery: { ts: number; doc: Record<string, unknown> } | null = null;

/** 读取并校验 OIDC 配置；未启用或缺失关键项时返回 null */
export function getOidcConfig(overrideRedirectUri?: string): OidcConfig | null {
  if (process.env.OIDC_ENABLED !== 'true') return null;
  const issuer = (process.env.OIDC_ISSUER || '').replace(/\/$/, '');
  const clientId = process.env.OIDC_CLIENT_ID || '';
  const clientSecret = process.env.OIDC_CLIENT_SECRET || '';
  if (!issuer || !clientId) return null;
  return {
    enabled: true,
    issuer,
    clientId,
    clientSecret,
    redirectUri: overrideRedirectUri || process.env.OIDC_REDIRECT_URI || '',
    scopes: process.env.OIDC_SCOPES || 'openid email profile',
    defaultRole: (process.env.OIDC_DEFAULT_ROLE as 'user' | 'admin') === 'admin' ? 'admin' : 'user',
    adminClaim: process.env.OIDC_ADMIN_CLAIM || '',
    adminValue: process.env.OIDC_ADMIN_VALUE || '',
    buttonLabel: process.env.OIDC_BUTTON_LABEL || 'SSO',
  };
}

/** 获取 OIDC discovery 文档（带 1 小时缓存） */
export async function discover(issuer: string): Promise<Record<string, unknown>> {
  if (cachedDiscovery && cachedDiscovery.ts > Date.now() - 3600_000) return cachedDiscovery.doc;
  const res = await fetch(`${issuer}/.well-known/openid-configuration`, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('无法获取 OIDC 发现文档');
  const doc = (await res.json()) as Record<string, unknown>;
  cachedDiscovery = { ts: Date.now(), doc };
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
