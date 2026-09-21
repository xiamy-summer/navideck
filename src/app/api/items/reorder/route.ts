import { reorderItems } from '@/lib/db';
import { fail, handle, ok, readJson, requireWrite, resolveTarget } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  return handle(async () => {
    const target = await resolveTarget(req);
    requireWrite(target);
    const { ids, groupId } = await readJson<{ ids?: number[]; groupId?: number }>(req);
    if (!Array.isArray(ids) || !groupId) return fail('参数错误');
    reorderItems(target.owner.id, Number(groupId), ids.map(Number));
    return ok({ success: true });
  });
}
