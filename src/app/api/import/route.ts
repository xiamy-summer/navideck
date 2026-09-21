import { createGroup, createItem, deleteGroup, listGroups, saveUserSettings } from '@/lib/db';
import { fail, handle, ok, readJson, requireWrite, resolveTarget } from '@/lib/api';
import type { BackupPayload, OpenMode, Settings } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  return handle(async () => {
    const target = await resolveTarget(req);
    requireWrite(target);
    const body = await readJson<{ payload?: BackupPayload; mode?: 'replace' | 'append' }>(req);
    const payload = body.payload;
    if (!payload || !Array.isArray(payload.groups)) return fail('文件格式不正确');
    const mode = body.mode ?? 'append';

    if (mode === 'replace') {
      for (const g of listGroups(target.owner.id)) deleteGroup(target.owner.id, g.id);
    }
    if (payload.settings) {
      const { siteTitle: _t, ...rest } = payload.settings as Partial<Settings>;
      saveUserSettings(target.owner.id, rest);
    }

    let groupCount = 0;
    let itemCount = 0;
    for (const g of payload.groups) {
      const group = createGroup(target.owner.id, g.name || '未命名分组', g.icon ?? null);
      groupCount += 1;
      for (const item of g.items ?? []) {
        createItem(target.owner.id, {
          groupId: group.id,
          title: item.title || '未命名',
          icon: item.icon ?? null,
          urlLan: item.urlLan ?? '',
          urlWan: item.urlWan ?? '',
          desc: item.desc ?? '',
          openMode: (item.openMode ?? 'blank') as OpenMode,
          color: item.color ?? null,
        });
        itemCount += 1;
      }
    }
    return ok({ success: true, groupCount, itemCount });
  });
}
