import { listItems } from '@/lib/db';
import { probeSite, type ProbeState } from '@/lib/probe';
import { fail, handle, ok, resolveTarget } from '@/lib/api';

export const dynamic = 'force-dynamic';

/**
 * 批量探测当前用户「未绑定容器」站点的 HTTP 可达性。
 * ?mode=lan|wan 决定优先探测内网还是外网地址（缺省 lan）；
 * 绑定了容器的站点跳过——它们用 Docker 容器状态展示。
 */
export async function GET(req: Request) {
  return handle(async () => {
    const target = await resolveTarget(req);
    if (!target.actor) return fail('未登录', 401);

    const url = new URL(req.url);
    const mode = url.searchParams.get('mode') === 'wan' ? 'wan' : 'lan';

    const items = listItems(target.owner.id).filter(
      (item) => !item.container && (item.urlLan || item.urlWan),
    );

    const entries = await Promise.all(
      items.map(async (item) => {
        const preferred = mode === 'wan' ? item.urlWan || item.urlLan : item.urlLan || item.urlWan;
        if (!preferred || !/^https?:\/\//i.test(preferred)) return null;
        const state: ProbeState = await probeSite(item.id, mode, preferred);
        return [item.id, state] as const;
      }),
    );

    const status: Record<string, ProbeState> = {};
    for (const e of entries) if (e) status[String(e[0])] = e[1];
    return ok({ mode, status });
  });
}
