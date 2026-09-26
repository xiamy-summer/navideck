import { clearAudit, listAudit } from '@/lib/audit';
import { fail, handle, ok, requireAdmin, resolveTarget } from '@/lib/api';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

/** 审计日志列表（仅管理员）：按时间倒序分页，可按操作类型 / 用户筛选 */
export async function GET(req: Request) {
  return handle(async () => {
    const target = await resolveTarget(req);
    requireAdmin(target);
    const url = new URL(req.url);
    const page = Number(url.searchParams.get('page') ?? '1');
    const pageSize = Number(url.searchParams.get('pageSize') ?? '20');
    const action = url.searchParams.get('action') || undefined;
    const rawUser = url.searchParams.get('userId');
    const userId = rawUser !== null && rawUser !== '' ? Number(rawUser) : undefined;
    return ok(listAudit({ page, pageSize, action, userId }));
  });
}

/** 清空审计日志（仅管理员） */
export async function DELETE(req: Request) {
  return handle(async () => {
    const target = await resolveTarget(req);
    requireAdmin(target);
    const removed = clearAudit();
    audit(req, {
      userId: target.actor?.id ?? 0,
      username: target.actor?.username ?? '',
      action: 'audit.clear',
      detail: `清除 ${removed} 条`,
    });
    return ok({ success: true, removed });
  });
}
