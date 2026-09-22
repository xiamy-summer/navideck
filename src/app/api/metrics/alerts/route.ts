import { ackMetricAlerts, countUnackAlerts, listMetricAlerts } from '@/lib/db';
import { fail, handle, ok, resolveTarget } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return handle(async () => {
    const target = await resolveTarget(req);
    if (!target.actor) return fail('未登录', 401);

    const url = new URL(req.url);
    const raw = Number(url.searchParams.get('limit'));
    const limit = Math.min(200, Math.max(1, Number.isFinite(raw) && raw > 0 ? raw : 50));
    const onlyUnack = url.searchParams.get('unack') === '1';

    return ok({ items: listMetricAlerts(limit, onlyUnack), unack: countUnackAlerts() });
  });
}

/** 确认告警：传 id 确认单条，传 all 或不传 id 则全部确认 */
export async function POST(req: Request) {
  return handle(async () => {
    const target = await resolveTarget(req);
    if (!target.actor) return fail('未登录', 401);

    const body = (await req.json().catch(() => ({}))) as { id?: number; all?: boolean };
    const id = typeof body.id === 'number' ? body.id : undefined;
    const changed = body.all || id === undefined ? ackMetricAlerts() : ackMetricAlerts(id);

    return ok({ changed, unack: countUnackAlerts() });
  });
}
