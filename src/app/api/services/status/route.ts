import { listServiceConfigs } from '@/lib/db';
import { probeService, type ProbeResult } from '@/lib/serviceWidgets';
import type { ItemService } from '@/lib/types';
import { fail, handle, ok, resolveTarget } from '@/lib/api';

export const dynamic = 'force-dynamic';

/** 批量拉取当前用户所有已配置服务的实时状态；密钥从库里读取，不经前端 */
export async function GET(req: Request) {
  return handle(async () => {
    const target = await resolveTarget(req);
    if (!target.actor) return fail('未登录', 401);

    const rows = listServiceConfigs(target.owner.id);
    const entries = await Promise.all(
      rows.map(async (row) => {
        try {
          const cfg = JSON.parse(row.service) as ItemService;
          const result = await probeService(cfg);
          return [String(row.id), result] as const;
        } catch {
          const result: ProbeResult = { ok: false, fields: [], message: '服务配置解析失败' };
          return [String(row.id), result] as const;
        }
      }),
    );

    return ok({ status: Object.fromEntries(entries) as Record<string, ProbeResult> });
  });
}
