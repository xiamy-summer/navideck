import { listTemplates } from '@/lib/serviceWidgets';
import { fail, handle, ok, resolveTarget } from '@/lib/api';

export const dynamic = 'force-dynamic';

/** 供前端下拉选择的内置服务模板清单 */
export async function GET(req: Request) {
  return handle(async () => {
    const target = await resolveTarget(req);
    if (!target.actor) return fail('未登录', 401);
    return ok({ templates: listTemplates() });
  });
}
