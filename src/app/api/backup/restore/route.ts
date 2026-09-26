import { restoreBackup } from '@/lib/db';
import { fail, handle, ok, readJson, requireAdmin, resolveTarget } from '@/lib/api';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  return handle(async () => {
    const target = await resolveTarget(req);
    requireAdmin(target);
    const body = await readJson<{ name?: string }>(req);
    if (!body.name) return fail('缺少备份文件名');
    const okRestore = restoreBackup(body.name);
    if (!okRestore) return fail('备份不存在');
    audit(req, {
      userId: target.actor?.id ?? 0,
      username: target.actor?.username ?? '',
      action: 'backup.restore',
      target: body.name,
    });
    return ok({ success: true });
  });
}
