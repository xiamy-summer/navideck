import { getCurrentUser, signToken, setSessionCookie } from '@/lib/auth';
import { getAuthUser, updateUser } from '@/lib/db';
import { fail, handle, ok, readJson } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  return handle(async () => {
    const me = await getCurrentUser();
    if (!me) return fail('未登录', 401);
    const { oldPassword, newPassword } = await readJson<{ oldPassword?: string; newPassword?: string }>(req);
    if (!newPassword || newPassword.length < 6) return fail('新密码至少 6 位');
    const row = getAuthUser(me.username)!;
    const { verifyPassword } = await import('@/lib/db');
    if (!verifyPassword(oldPassword ?? '', row.passwordHash)) return fail('原密码不正确');
    updateUser(me.id, { password: newPassword });
    const fresh = getAuthUser(me.username)!;
    await setSessionCookie(await signToken(fresh));
    return ok({ success: true });
  });
}
