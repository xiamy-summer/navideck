import { reorderGroups } from '@/lib/db';
import { handle, ok, readJson, requireWrite, resolveTarget } from '@/lib/api';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  return handle(async () => {
    const target = await resolveTarget(req);
    requireWrite(target);
    const { ids } = await readJson<{ ids?: number[] }>(req);
    if (!Array.isArray(ids)) return new Response(JSON.stringify({ error: '参数错误' }), { status: 400 });
    reorderGroups(target.owner.id, ids.map(Number));
    audit(req, {
      userId: target.actor?.id ?? 0,
      username: target.actor?.username ?? '',
      action: 'group.reorder',
      detail: `${ids.length} 个分组`,
    });
    return ok({ success: true });
  });
}
