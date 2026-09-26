import { getGlobalSettings, getUserSettings, saveUserSettings } from '@/lib/db';
import { fail, handle, ok, readJson, requireWrite, resolveTarget } from '@/lib/api';
import { audit } from '@/lib/audit';
import type { Settings } from '@/lib/types';

export const dynamic = 'force-dynamic';

/** 已保存密钥的占位符：前端收到即代表「密钥已配置」，原样回传时不会覆盖真实值 */
const SECRET_MASK = '__set__';

function maskSecret(settings: Settings): Settings {
  return { ...settings, oidcClientSecret: settings.oidcClientSecret ? SECRET_MASK : '' };
}

export async function GET(req: Request) {
  return handle(async () => {
    const target = await resolveTarget(req);
    if (new URL(req.url).searchParams.get('global') === '1') {
      if (target.actor?.role !== 'admin') return fail('需要管理员权限', 403);
      return ok(maskSecret(getGlobalSettings()));
    }
    return ok(maskSecret(getUserSettings(target.owner.id)));
  });
}

export async function PUT(req: Request) {
  return handle(async () => {
    const target = await resolveTarget(req);
    requireWrite(target);
    const body = await readJson<Partial<Settings>>(req);
    const patch: Partial<Settings> = { ...body };
    // 占位符表示不修改密钥，直接丢弃该字段
    if (patch.oidcClientSecret === SECRET_MASK) delete patch.oidcClientSecret;
    const url = new URL(req.url);
    const isGlobal = url.searchParams.get('global') === '1';
    const changedKeys = Object.keys(patch).join(', ') || undefined;
    if (isGlobal) {
      if (target.actor?.role !== 'admin') return fail('需要管理员权限', 403);
      audit(req, {
        userId: target.actor?.id ?? 0,
        username: target.actor?.username ?? '',
        action: 'settings.update',
        detail: `全局：${changedKeys ?? '无'}`,
      });
      return ok(saveUserSettings(0, patch));
    }
    audit(req, {
      userId: target.actor?.id ?? 0,
      username: target.actor?.username ?? '',
      action: 'settings.update',
      detail: changedKeys,
    });
    return ok(saveUserSettings(target.owner.id, patch));
  });
}
