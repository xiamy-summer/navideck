import { getGlobalSettings, getUserSettings, saveUserSettings } from '@/lib/db';
import { fail, handle, ok, readJson, requireWrite, resolveTarget } from '@/lib/api';
import type { Settings } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return handle(async () => {
    const target = await resolveTarget(req);
    if (new URL(req.url).searchParams.get('global') === '1') {
      if (target.actor?.role !== 'admin') return fail('需要管理员权限', 403);
      return ok(getGlobalSettings());
    }
    return ok(getUserSettings(target.owner.id));
  });
}

export async function PUT(req: Request) {
  return handle(async () => {
    const target = await resolveTarget(req);
    requireWrite(target);
    const body = await readJson<Partial<Settings>>(req);
    const url = new URL(req.url);
    const isGlobal = url.searchParams.get('global') === '1';
    if (isGlobal) {
      if (target.actor?.role !== 'admin') return fail('需要管理员权限', 403);
      return ok(saveUserSettings(0, body));
    }
    return ok(saveUserSettings(target.owner.id, body));
  });
}
