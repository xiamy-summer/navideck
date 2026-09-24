import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import crypto from 'node:crypto';
import { exchangeAndVerify, getOidcConfig, resolveOrigin } from '@/lib/oidc';
import { fail } from '@/lib/api';
import { createUser, getUserByName } from '@/lib/db';
import { signToken } from '@/lib/auth';
import { seedDemo } from '@/lib/bootstrap';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const origin = resolveOrigin(req);
  const redirectUri = `${origin}/api/auth/oidc/callback`;
  const url = new URL(req.url);
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const error = url.searchParams.get('error');

  const store = await cookies();
  const cookieState = store.get('oidc_state')?.value;
  const nonce = store.get('oidc_nonce')?.value;
  const verifier = store.get('oidc_verifier')?.value;

  const res = NextResponse.redirect(new URL('/', origin), 302);
  const clearOpts = { httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 0 };
  res.cookies.set('oidc_state', '', clearOpts);
  res.cookies.set('oidc_nonce', '', clearOpts);
  res.cookies.set('oidc_verifier', '', clearOpts);

  if (error) return fail(`单点登录被拒绝：${error}`, 400);
  if (!code || !state || !cookieState || !nonce || !verifier) return fail('缺少回调参数', 400);
  if (state !== cookieState) return fail('state 校验失败', 400);

  const cfg = getOidcConfig(redirectUri);
  if (!cfg) return fail('单点登录未启用', 400);

  let claims;
  try {
    claims = await exchangeAndVerify(cfg, code, verifier, nonce);
  } catch (e) {
    return fail(e instanceof Error ? e.message : '单点登录验证失败', 400);
  }

  let user = getUserByName(claims.username);
  if (!user) {
    // 首次登录自动建档（随机口令，仅供本地占位，实际凭 OIDC 登录）
    const password = crypto.randomBytes(24).toString('hex');
    user = createUser(claims.username, password, claims.role);
    seedDemo(user.id);
  }

  const token = await signToken({
    id: user.id,
    username: user.username,
    role: user.role,
    tokenVersion: (user as { tokenVersion?: number }).tokenVersion ?? 1,
  });
  res.cookies.set('nas-nav-token', token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
