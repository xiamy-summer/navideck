import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { discover, getOidcConfig } from '@/lib/oidc';

export const dynamic = 'force-dynamic';

/**
 * 管理员自助诊断：用当前保存的全局配置尝试获取 IdP 元数据（discovery）。
 * 这一步是登录流程最容易失败的地方，单独暴露出来便于定位：
 * 是 Issuer 写错、容器网络不通、证书不受信，还是 IdP 返回的 issuer 与填写值不一致。
 */
export async function POST() {
  const me = await getCurrentUser();
  if (!me || me.role !== 'admin') {
    return NextResponse.json({ ok: false, message: '需要管理员权限' }, { status: 403 });
  }

  const cfg = getOidcConfig();
  if (!cfg) {
    return NextResponse.json({
      ok: false,
      message: '配置不完整：需先启用单点登录，并填写 Issuer 与 Client ID（且保存到「全局设置」）',
    });
  }

  const started = Date.now();
  try {
    const doc = await discover(cfg.issuer);
    const remoteIssuer = String(doc.issuer || '');
    const mismatch = remoteIssuer !== cfg.issuer;
    return NextResponse.json({
      ok: true,
      ms: Date.now() - started,
      issuer: cfg.issuer,
      authorizationEndpoint: String(doc.authorization_endpoint || ''),
      tokenEndpoint: String(doc.token_endpoint || ''),
      // IdP 返回的 issuer 与填写值不一致时，ID Token 的 iss 校验会失败，这里提前预警
      warning: mismatch
        ? `IdP 返回的 issuer 是「${remoteIssuer}」，与你填写的「${cfg.issuer}」不一致，请以 IdP 的值为准，否则登录会在校验 ID Token 时失败`
        : '',
      message: '连接成功，已获取 IdP 元数据',
    });
  } catch (e) {
    return NextResponse.json({
      ok: false,
      ms: Date.now() - started,
      issuer: cfg.issuer,
      message: e instanceof Error ? e.message : '连接失败',
    });
  }
}
