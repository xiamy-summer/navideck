import { restoreBackup } from '@/lib/db';
import { fail, handle, ok, readJson, requireAdmin, resolveTarget } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  return handle(async () => {
    const target = await resolveTarget(req);
    requireAdmin(target);
    const body = await readJson<{ name?: string }>(req);
    if (!body.name) return fail('缺少备份文件名');
    const okRestore = restoreBackup(body.name);
    if (!okRestore) return fail('备份不存在');
    return ok({ success: true });
  });
}
