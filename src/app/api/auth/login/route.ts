import { ensureBootstrap } from '@/lib/bootstrap';
import { getAuthUser, verifyPassword } from '@/lib/db';
import { signToken, setSessionCookie } from '@/lib/auth';
import { fail, handle, ok, readJson } from '@/lib/api';
import { getUserById, updateUser } from '@/lib/db';
import { isWeakPassword } from '@/lib/weakPassword';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

const attempts = new Map<string, { count: number; resetAt: number }>();

function tooMany(key: string) {
  const now = Date.now();
  const rec = attempts.get(key);
  if (!rec || rec.resetAt < now) {
    attempts.set(key, { count: 1, resetAt: now + 60_000 });
    return false;
  }
  rec.count += 1;
  return rec.count > 10;
}

export async function POST(req: Request) {
  return handle(async () => {
    ensureBootstrap();
    const { username, password } = await readJson<{ username?: string; password?: string }>(req);
    if (!username || !password) return fail('用户名和密码不能为空');
    const ip = req.headers.get('x-forwarded-for') || 'local';
    if (tooMany(ip)) return fail('尝试过于频繁，请稍后再试', 429);

    const row = getAuthUser(username);
    if (!row || row.role === 'guest' || !verifyPassword(password, row.passwordHash)) {
      audit(req, { action: 'auth.loginFailed', target: username, ip });
      return fail('用户名或密码错误', 401);
    }
    audit(req, { userId: row.id, username: row.username, action: 'auth.login', ip });
    // 登录成功时才能看到明文密码，就地判定强弱并打标记（不阻断登录，仅前端提示）
    const weak = isWeakPassword(password, process.env.DEFAULT_ADMIN_PASSWORD);
    if (weak !== (row.mustChangePassword === 1)) {
      updateUser(row.id, { mustChangePassword: weak ? 1 : 0 });
    }
    const token = await signToken({ id: row.id, username: row.username, role: row.role, tokenVersion: row.tokenVersion });
    await setSessionCookie(token);
    attempts.delete(ip);
    return ok(getUserById(row.id));
  });
}
