import { getCurrentUser } from '@/lib/auth';
import { ensureBootstrap } from '@/lib/bootstrap';
import { getUserByName, getUserSettings } from '@/lib/db';
import { handle, ok } from '@/lib/api';
import { listUsers } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  return handle(async () => {
    ensureBootstrap();
    const me = await getCurrentUser();
    const guest = getUserByName('guest');
    const settings = getUserSettings(me?.id ?? guest?.id ?? 0);
    return ok({
      user: me,
      guestId: guest?.id ?? null,
      settings,
      users: me?.role === 'admin' ? listUsers() : [],
      initialized: true,
    });
  });
}
