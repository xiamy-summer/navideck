import { createBackup, deleteBackup, listBackups } from '@/lib/db';
import { fail, handle, ok, readJson, requireWrite, resolveTarget } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return handle(async () => {
    const target = await resolveTarget(req);
    requireWrite(target);
    return ok({ backups: listBackups() });
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const target = await resolveTarget(req);
    requireWrite(target);
    return ok({ backup: createBackup() });
  });
}

export async function DELETE(req: Request) {
  return handle(async () => {
    const target = await resolveTarget(req);
    requireWrite(target);
    const body = await readJson<{ name?: string }>(req);
    if (!body.name) return fail('缺少备份文件名');
    const okDel = deleteBackup(body.name);
    if (!okDel) return fail('备份不存在');
    return ok({ success: true });
  });
}
