import os from 'node:os';
import { DATA_DIR } from '@/lib/db';
import { diskInfo, ensureSampler, getHistory, sample } from '@/lib/metrics';
import { fail, handle, ok, resolveTarget } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return handle(async () => {
    const target = await resolveTarget(req);
    if (!target.actor) return fail('未登录', 401);

    ensureSampler();
    const history = getHistory();
    const current = history.length ? history[history.length - 1] : sample();
    const total = os.totalmem();
    const free = os.freemem();
    const used = total - free;

    return ok({
      current,
      history,
      disk: diskInfo(DATA_DIR),
      memory: {
        totalGb: +(total / 1073741824).toFixed(1),
        usedGb: +(used / 1073741824).toFixed(1),
        freeGb: +(free / 1073741824).toFixed(1),
        usedPercent: +((used / total) * 100).toFixed(1),
      },
      cpu: {
        count: os.cpus().length,
        model: os.cpus()[0]?.model ?? '未知',
        loadAvg: os.loadavg().map((n) => +n.toFixed(2)),
      },
      osUptime: Math.round(os.uptime()),
    });
  });
}
