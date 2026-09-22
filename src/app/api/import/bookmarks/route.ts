import { fail, handle, ok, requireWrite, resolveTarget } from '@/lib/api';
import { importBookmarks } from '@/lib/bookmarks';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  return handle(async () => {
    const target = await resolveTarget(req);
    requireWrite(target);

    let html = '';
    let mode: 'replace' | 'append' = 'append';

    const contentType = req.headers.get('content-type') || '';
    if (contentType.includes('multipart/form-data')) {
      const form = await req.formData();
      const file = form.get('file');
      if (!(file instanceof File)) return fail('未收到书签文件');
      html = await file.text();
      const m = form.get('mode');
      if (m === 'replace' || m === 'append') mode = m;
    } else {
      const body = (await req.json().catch(() => ({}))) as { html?: string; mode?: string };
      html = body.html || '';
      if (body.mode === 'replace' || body.mode === 'append') mode = body.mode;
    }

    if (!html || !/<A\s/i.test(html)) return fail('文件不是有效的书签 HTML');
    const res = importBookmarks(target.owner.id, html, mode);
    return ok({ success: true, groupCount: res.groupCount, itemCount: res.itemCount });
  });
}
