import { containerAction, containerLogs, dockerAvailable } from '@/lib/docker';
import { fail, handle, ok, readJson, requireAdmin, resolveTarget } from '@/lib/api';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

const ACTIONS = ['start', 'stop', 'restart'] as const;

/** 容器操作：start / stop / restart（仅管理员） */
export async function POST(req: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const target = await resolveTarget(req);
    requireAdmin(target);
    if (!dockerAvailable()) return fail('Docker Socket 不可用', 503);

    const { action } = await readJson<{ action?: string }>(req);
    if (!action || !ACTIONS.includes(action as (typeof ACTIONS)[number])) {
      return fail('不支持的操作');
    }
    await containerAction(id, action as (typeof ACTIONS)[number]);
    return ok({ success: true });
  });
}

/** 容器日志（仅管理员） */
export async function GET(req: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const target = await resolveTarget(req);
    requireAdmin(target);
    if (!dockerAvailable()) return fail('Docker Socket 不可用', 503);

    const url = new URL(req.url);
    const tail = Math.min(2000, Math.max(20, Number(url.searchParams.get('tail')) || 200));
    const logs = await containerLogs(id, tail);
    return ok({ logs });
  });
}
