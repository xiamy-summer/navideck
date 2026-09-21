import { createUser, listUsers } from '@/lib/db';
import { fail, handle, ok, readJson, requireAdmin, resolveTarget } from '@/lib/api';
import type { Role } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return handle(async () => {
    const target = await resolveTarget(req);
    requireAdmin(target);
    return ok(listUsers());
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const target = await resolveTarget(req);
    requireAdmin(target);
    const body = await readJson<{ username?: string; password?: string; role?: Role }>(req);
    const username = (body.username ?? '').trim();
    if (!username) return fail('用户名不能为空');
    if ((body.password ?? '').length < 6) return fail('密码至少 6 位');
    if (body.role === 'guest') return fail('访客账号不可重复创建');
    try {
      const user = createUser(username, body.password!, body.role ?? 'user');
      return ok(user, { status: 201 });
    } catch {
      return fail('用户名已存在', 409);
    }
  });
}
