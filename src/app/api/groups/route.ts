import { createGroup, listGroups, listItems } from '@/lib/db';
import { fail, handle, ok, readJson, requireWrite, resolveTarget } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return handle(async () => {
    const { owner } = await resolveTarget(req);
    const groups = listGroups(owner.id);
    const items = listItems(owner.id);
    return ok(
      groups.map((g) => ({
        ...g,
        items: items.filter((i) => i.groupId === g.id),
      })),
    );
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const target = await resolveTarget(req);
    requireWrite(target);
    const body = await readJson<{ name?: string; icon?: string | null }>(req);
    const name = (body.name ?? '').trim();
    if (!name) return fail('分组名称不能为空');
    return ok(createGroup(target.owner.id, name, body.icon ?? null), { status: 201 });
  });
}
