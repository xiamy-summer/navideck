import { clearSessionCookie, getCurrentUser } from '@/lib/auth';
import { handle, ok } from '@/lib/api';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  return handle(async () => {
    const me = await getCurrentUser();
    await clearSessionCookie();
    audit(req, { userId: me?.id ?? 0, username: me?.username ?? '', action: 'auth.logout' });
    return ok({ success: true });
  });
}
