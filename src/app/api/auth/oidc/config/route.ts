import { NextResponse } from 'next/server';
import { getOidcConfig } from '@/lib/oidc';

export const dynamic = 'force-dynamic';

/** 公开端点：仅暴露是否启用与按钮文案，不含任何密钥 */
export async function GET() {
  const cfg = getOidcConfig();
  return NextResponse.json({ enabled: Boolean(cfg), label: cfg?.buttonLabel || 'SSO' });
}
