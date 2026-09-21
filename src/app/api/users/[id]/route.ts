import { deleteUser, getUserById, updateUser } from '@/lib/db';
import { fail, handle, ok, readJson, requireAdmin, resolveTarget } from '@/lib/api';
import type { Role } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const target = await resolveTarget(req);
    requireAdmin(target);
    const body = await readJson<{ username?: string; password?: string; role?: Role; avatar?: string | null }>(req);
    const existing = getUserById(Number(id));
    if (!existing) return fail('用户不存在', 404);
    if (existing.role === 'guest' && body.role && body.role !== 'guest') {
      return fail('访客账号角色不可变更');
    }
    if (body.password && body.password.length < 6) return fail('密码至少 6 位');
    const updated = updateUser(Number(id), body);
    return ok(updated);
  });
}

export async function DELETE(req: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const target = await resolveTarget(req);
    requireAdmin(target);
    const existing = getUserById(Number(id));
    if (!existing) return fail('用户不存在', 404);
    if (existing.role === 'guest') return fail('访客账号不可删除');
    if (existing.id === target.actor?.id) return fail('不能删除当前登录账号');
    deleteUser(Number(id));
    return ok({ success: true });
  });
}
