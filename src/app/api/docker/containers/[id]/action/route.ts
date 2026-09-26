import { containerAction } from '@/lib/docker';
import { fail, handle, ok, readJson, requireAdmin, resolveTarget } from '@/lib/api';
import { audit } from '@/lib/audit';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

const ACTIONS = ['start', 'stop', 'restart'] as const;

export async function POST(req: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const target = await resolveTarget(req);
    requireAdmin(target);

    const { action } = await readJson<{ action?: string }>(req);
    if (!action || !ACTIONS.includes(action as (typeof ACTIONS)[number])) {
      return fail('不支持的操作');
    }
    await containerAction(id, action as (typeof ACTIONS)[number]);
    audit(req, {
      userId: target.actor?.id ?? 0,
      username: target.actor?.username ?? '',
      action: 'docker.action',
      target: id,
      detail: action,
    });
    return ok({ success: true });
  });
}
