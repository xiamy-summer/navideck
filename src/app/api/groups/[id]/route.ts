import { deleteGroup, updateGroup } from '@/lib/db';
import { fail, handle, ok, readJson, requireWrite, resolveTarget } from '@/lib/api';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const target = await resolveTarget(req);
    requireWrite(target);
    const body = await readJson<{ name?: string; icon?: string | null; sort?: number }>(req);
    if (body.name !== undefined && !body.name.trim()) return fail('分组名称不能为空');
    const updated = updateGroup(target.owner.id, Number(id), {
      name: body.name?.trim(),
      icon: body.icon,
      sort: body.sort,
    });
    if (!updated) return fail('分组不存在', 404);
    audit(req, {
      userId: target.actor?.id ?? 0,
      username: target.actor?.username ?? '',
      action: 'group.update',
      target: updated.name,
    });
    return ok(updated);
  });
}

export async function DELETE(req: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const target = await resolveTarget(req);
    requireWrite(target);
    if (!deleteGroup(target.owner.id, Number(id))) return fail('分组不存在', 404);
    audit(req, {
      userId: target.actor?.id ?? 0,
      username: target.actor?.username ?? '',
      action: 'group.delete',
      target: `分组 #${id}`,
    });
    return ok({ success: true });
  });
}
