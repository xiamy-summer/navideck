import { createItem } from '@/lib/db';
import { fail, handle, ok, readJson, requireWrite, resolveTarget } from '@/lib/api';
import { audit } from '@/lib/audit';
import type { Item, OpenMode } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  return handle(async () => {
    const target = await resolveTarget(req);
    requireWrite(target);
    const body = await readJson<Partial<Item> & { groupId?: number; title?: string }>(req);
    const title = (body.title ?? '').trim();
    if (!title) return fail('站点名称不能为空');
    if (!body.groupId) return fail('缺少分组');
    const item = createItem(target.owner.id, {
      groupId: Number(body.groupId),
      title,
      icon: body.icon ?? null,
      urlLan: body.urlLan ?? '',
      urlWan: body.urlWan ?? '',
      desc: body.desc ?? '',
      openMode: (body.openMode ?? 'blank') as OpenMode,
      color: body.color ?? null,
      service: body.service ?? null,
      container: body.container ?? null,
      cardSize: body.cardSize ?? null,
    });
    audit(req, {
      userId: target.actor?.id ?? 0,
      username: target.actor?.username ?? '',
      action: 'item.create',
      target: title,
    });
    return ok(item, { status: 201 });
  });
}
