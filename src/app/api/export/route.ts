import { getUserSettings, listGroups, listItems } from '@/lib/db';
import { handle, resolveTarget } from '@/lib/api';
import type { BackupPayload } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return handle(async () => {
    const { owner } = await resolveTarget(req);
    const groups = listGroups(owner.id);
    const items = listItems(owner.id);
    const payload: BackupPayload = {
      version: 1,
      exportedAt: Date.now(),
      settings: getUserSettings(owner.id),
      groups: groups.map((g) => ({
        name: g.name,
        icon: g.icon,
        sort: g.sort,
        items: items
          .filter((i) => i.groupId === g.id)
          .map((i) => ({
            title: i.title,
            icon: i.icon,
            urlLan: i.urlLan,
            urlWan: i.urlWan,
            desc: i.desc,
            openMode: i.openMode,
            color: i.color,
            sort: i.sort,
          })),
      })),
    };
    const body = JSON.stringify(payload, null, 2);
    const stamp = new Date().toISOString().slice(0, 10);
    return new Response(body, {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename="nas-nav-${owner.username}-${stamp}.json"`,
      },
    });
  });
}
