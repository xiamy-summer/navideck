import fs from 'node:fs/promises';
import path from 'node:path';
import { findFileByHash, UPLOAD_DIR } from '@/lib/db';
import { handle } from '@/lib/api';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ key: string[] }> };

/** 通过 /api/files/<hash>.<ext> 访问已上传的文件 */
export async function GET(_req: Request, ctx: Ctx) {
  return handle(async () => {
    const { key } = await ctx.params;
    const joined = key.join('/');
    const hash = path.basename(joined, path.extname(joined));
    const record = findFileByHash(hash);
    if (!record) return new Response('Not Found', { status: 404 });
    const data = await fs.readFile(path.join(UPLOAD_DIR, record.path));
    return new Response(new Uint8Array(data), {
      headers: {
        'Content-Type': record.mime,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  });
}
