import type { ItemService } from '@/lib/types';
import { probeService } from '@/lib/serviceWidgets';
import { fail, handle, ok, resolveTarget } from '@/lib/api';

export const dynamic = 'force-dynamic';

/** 编辑站点时的「测试连接」，不写缓存，密钥仅本次请求使用 */
export async function POST(req: Request) {
  return handle(async () => {
    const target = await resolveTarget(req);
    if (!target.actor) return fail('未登录', 401);

    const body = (await req.json().catch(() => ({}))) as { config?: ItemService };
    if (!body.config || !body.config.url) return fail('缺少服务地址', 400);

    const result = await probeService(body.config, false);
    return ok(result);
  });
}
