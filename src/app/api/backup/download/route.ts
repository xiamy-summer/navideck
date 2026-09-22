import { existsSync, statSync } from 'node:fs';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { BACKUP_DIR } from '@/lib/db';
import { fail, handle, requireWrite, resolveTarget } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return handle(async () => {
    const target = await resolveTarget(req);
    requireWrite(target);
    const name = new URL(req.url).searchParams.get('name');
    if (!name) return fail('缺少备份文件名');
    const safe = path.basename(name);
    if (!safe.startsWith('nav-') || !safe.endsWith('.db')) return fail('非法的备份文件名');
    const p = path.join(BACKUP_DIR, safe);
    if (!existsSync(p)) return fail('备份不存在');
    const size = statSync(p).size;
    const stream = createReadStream(p);
    return new Response(stream as unknown as ReadableStream, {
      headers: {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(size),
        'Content-Disposition': `attachment; filename="${safe}"`,
      },
    });
  });
}
