import { queryMetricSamples } from '@/lib/db';
import { fail, handle, ok, resolveTarget } from '@/lib/api';

export const dynamic = 'force-dynamic';

const RANGE_MS: Record<string, number> = {
  '1h': 3600_000,
  '24h': 24 * 3600_000,
  '7d': 7 * 86_400_000,
};
/** 返回给前端的最大点数，超出则均匀降采样 */
const MAX_POINTS = 240;

export async function GET(req: Request) {
  return handle(async () => {
    const target = await resolveTarget(req);
    if (!target.actor) return fail('未登录', 401);

    const url = new URL(req.url);
    const range = url.searchParams.get('range') || '24h';
    const span = RANGE_MS[range] ?? RANGE_MS['24h'];
    const until = Date.now();
    const rows = queryMetricSamples(until - span, until);
    const step = rows.length > MAX_POINTS ? Math.ceil(rows.length / MAX_POINTS) : 1;
    const items = step === 1 ? rows : rows.filter((_, i) => i % step === 0);

    return ok({ range, total: rows.length, items });
  });
}
