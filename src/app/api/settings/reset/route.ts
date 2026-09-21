import { resetUserSettings } from '@/lib/db';
import { handle, ok, requireWrite, resolveTarget } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  return handle(async () => {
    const target = await resolveTarget(req);
    requireWrite(target);
    return ok(resetUserSettings(target.owner.id));
  });
}
