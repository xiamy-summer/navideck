import { NextResponse } from 'next/server';
import { buildAuthorizeUrl, genPkce, genRandom, getOidcConfig } from '@/lib/oidc';
import { fail } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const redirectUri = `${origin}/api/auth/oidc/callback`;
  const cfg = getOidcConfig(redirectUri);
  if (!cfg) return fail('单点登录未启用', 400);

  const state = genRandom();
  const nonce = genRandom();
  const { verifier, challenge } = genPkce();

  let authorizeUrl: string;
  try {
    authorizeUrl = await buildAuthorizeUrl(cfg, { state, nonce, codeChallenge: challenge });
  } catch (e) {
    // 把 discover() 抛出的具体原因透出，便于直接定位 issuer / 网络 / 证书问题
    return fail(e instanceof Error ? e.message : 'OIDC 配置错误，无法构造授权地址', 500);
  }

  const res = NextResponse.redirect(authorizeUrl, 302);
  const opts = { httpOnly: true, sameSite: 'lax' as const, secure: process.env.NODE_ENV === 'production', path: '/', maxAge: 600 };
  res.cookies.set('oidc_state', state, opts);
  res.cookies.set('oidc_nonce', nonce, opts);
  res.cookies.set('oidc_verifier', verifier, opts);
  return res;
}
