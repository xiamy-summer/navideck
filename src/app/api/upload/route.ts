import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import { addFileRecord, bumpFileRef, deleteFile, findFileByHash, listFiles, UPLOAD_DIR } from '@/lib/db';
import { fail, handle, ok, requireWrite, resolveTarget } from '@/lib/api';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  return handle(async () => {
    const { owner } = await resolveTarget(req);
    return ok(listFiles(owner.id));
  });
}

export async function POST(req: Request) {
  return handle(async () => {
    const target = await resolveTarget(req);
    requireWrite(target);
    const form = await req.formData();
    const file = form.get('file');
    if (!(file instanceof File)) return fail('缺少文件');
    if (file.size > 20 * 1024 * 1024) return fail('文件超过 20MB 限制');

    const buffer = Buffer.from(await file.arrayBuffer());
    const hash = crypto.createHash('sha256').update(buffer).digest('hex');

    // 内容去重：已存在同哈希文件时只增加引用计数，不重复占用磁盘
    const existing = findFileByHash(hash);
    if (existing) {
      bumpFileRef(existing.id);
      return ok({ ...existing, dedup: true }, { status: 200 });
    }

    const ext = path.extname(file.name) || '.bin';
    const stored = `${hash}${ext}`;
    await fs.mkdir(UPLOAD_DIR, { recursive: true });
    await fs.writeFile(path.join(UPLOAD_DIR, stored), buffer);
    const record = addFileRecord(target.owner.id, {
      hash,
      name: file.name,
      mime: file.type || 'application/octet-stream',
      size: file.size,
      path: stored,
    });
    return ok({ ...record, dedup: false }, { status: 201 });
  });
}

export async function DELETE(req: Request) {
  return handle(async () => {
    const target = await resolveTarget(req);
    requireWrite(target);
    const id = Number(new URL(req.url).searchParams.get('id'));
    if (!id) return fail('缺少 id');
    const removed = deleteFile(target.owner.id, id);
    if (!removed) return fail('文件不存在', 404);
    // 仍被其他记录引用时不删除物理文件
    if (removed.refCount <= 1 && !findFileByHash(removed.hash)) {
      await fs.rm(path.join(UPLOAD_DIR, removed.path), { force: true });
    }
    return ok({ success: true });
  });
}
