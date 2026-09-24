import { fail, handle, ok, requireWrite, resolveTarget } from '@/lib/api';
import { importSunPanel } from '@/lib/sunPanel';

export const dynamic = 'force-dynamic';

/** 导入 Sun-Panel 导出的 JSON 配置（*.sun-panel.json） */
export async function POST(req: Request) {
  return handle(async () => {
    const target = await resolveTarget(req);
    requireWrite(target);

    let content = '';
    let mode: 'replace' | 'append' = 'append';

    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const file = form.get('file');
      if (!(file instanceof File)) return fail('未收到配置文件');
      content = await file.text();
      const m = form.get('mode');
      if (m === 'replace' || m === 'append') mode = m;
    } else {
      const body = (await req.json().catch(() => ({}))) as { content?: string; mode?: string };
      content = body.content || '';
      if (body.mode === 'replace' || body.mode === 'append') mode = body.mode;
    }

    if (!content.trim()) return fail('配置文件为空');
    const res = importSunPanel(target.owner.id, content, mode);
    return ok({
      success: true,
      groupCount: res.groupCount,
      itemCount: res.itemCount,
      iconCount: res.iconCount,
    });
  });
}
