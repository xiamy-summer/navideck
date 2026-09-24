import { deleteItem, updateItem } from '@/lib/db';
import { fail, handle, ok, readJson, requireWrite, resolveTarget } from '@/lib/api';
import type { Item, OpenMode } from '@/lib/types';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const target = await resolveTarget(req);
    requireWrite(target);
    const body = await readJson<Partial<Item>>(req);
    const patch: Parameters<typeof updateItem>[2] = {};
    if (body.title !== undefined) {
      if (!body.title.trim()) return fail('站点名称不能为空');
      patch.title = body.title.trim();
    }
    if (body.icon !== undefined) patch.icon = body.icon;
    if (body.urlLan !== undefined) patch.urlLan = body.urlLan;
    if (body.urlWan !== undefined) patch.urlWan = body.urlWan;
    if (body.desc !== undefined) patch.desc = body.desc;
    if (body.color !== undefined) patch.color = body.color;
    if (body.openMode !== undefined) patch.openMode = body.openMode as OpenMode;
    if (body.groupId !== undefined) patch.groupId = Number(body.groupId);
    if (body.sort !== undefined) patch.sort = Number(body.sort);
    if (body.service !== undefined) patch.service = body.service;
    if (body.container !== undefined) patch.container = body.container;
    const updated = updateItem(target.owner.id, Number(id), patch);
    if (!updated) return fail('站点不存在', 404);
    return ok(updated);
  });
}

export async function DELETE(req: Request, ctx: Ctx) {
  return handle(async () => {
    const { id } = await ctx.params;
    const target = await resolveTarget(req);
    requireWrite(target);
    if (!deleteItem(target.owner.id, Number(id))) return fail('站点不存在', 404);
    return ok({ success: true });
  });
}
