import os from 'node:os';
import fs from 'node:fs';
import path from 'node:path';
import { db, DATA_DIR, countUsers } from '@/lib/db';
import { fail, handle, ok, resolveTarget } from '@/lib/api';
import { APP_VERSION } from '@/lib/version';

export const dynamic = 'force-dynamic';

const VERSION = APP_VERSION;

export async function GET(req: Request) {
  return handle(async () => {
    const target = await resolveTarget(req);
    if (!target.actor) return fail('未登录', 401);
    const owner = target.owner;

    const mem = process.memoryUsage();
    const cpus = os.cpus();
    const dbPath = path.join(DATA_DIR, 'nav.db');
    let dbSize = 0;
    try {
      dbSize = fs.statSync(dbPath).size;
    } catch {
      dbSize = 0;
    }

    const one = (sql: string, ...args: unknown[]) =>
      (db.prepare(sql).get(...args) as { c: number } | undefined)?.c ?? 0;

    const groups = one('SELECT COUNT(*) AS c FROM groups WHERE userId = ?', owner.id);
    const items = one('SELECT COUNT(*) AS c FROM items WHERE userId = ?', owner.id);
    const files = one('SELECT COUNT(*) AS c FROM files WHERE userId = ?', owner.id);

    return ok({
      version: VERSION,
      service: {
        pid: process.pid,
        uptime: Math.round(process.uptime()),
        nodeVersion: process.version,
        rssMb: +(mem.rss / 1048576).toFixed(1),
        heapUsedMb: +(mem.heapUsed / 1048576).toFixed(1),
      },
      host: {
        hostname: os.hostname(),
        platform: `${os.type()} ${os.release()}`,
        arch: os.arch(),
        cpuModel: cpus[0]?.model ?? '未知',
        cpuCount: cpus.length,
        loadAvg: os.loadavg().map((n) => +n.toFixed(2)),
        totalMemGb: +(os.totalmem() / 1073741824).toFixed(1),
        freeMemGb: +(os.freemem() / 1073741824).toFixed(1),
        osUptime: Math.round(os.uptime()),
      },
      data: {
        dataDir: DATA_DIR,
        dbSizeMb: +(dbSize / 1048576).toFixed(2),
        groups,
        items,
        files,
        users: countUsers(),
      },
    });
  });
}
