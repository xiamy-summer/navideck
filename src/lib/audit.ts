import { db } from './db';

/**
 * 操作审计：记录「谁在什么时间对什么做了什么」。
 * 审计是旁路功能，任何写入失败都不能影响业务主流程，因此这里统一吞掉异常。
 */

export interface AuditEntry {
  id: number;
  userId: number;
  username: string;
  action: string;
  target: string | null;
  detail: string | null;
  ip: string | null;
  createdAt: number;
}

export interface AuditInput {
  userId?: number | null;
  username?: string | null;
  action: string;
  target?: string | null;
  detail?: string | null;
  ip?: string | null;
}

/** 客户端 IP：反代后优先 X-Forwarded-For，其次 X-Real-IP */
export function clientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0]!.trim();
  return req.headers.get('x-real-ip') || 'local';
}

export function recordAudit(input: AuditInput): void {
  try {
    db.prepare(
      `INSERT INTO audit_logs (userId, username, action, target, detail, ip, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      input.userId ?? 0,
      input.username ?? '',
      input.action,
      input.target ?? null,
      input.detail ?? null,
      input.ip ?? null,
      Date.now(),
    );
  } catch {
    /* 审计写入失败不影响业务 */
  }
}

/** 便捷封装：把请求的 IP 一起带上 */
export function audit(req: Request, input: AuditInput): void {
  recordAudit({ ...input, ip: input.ip ?? clientIp(req) });
}

export function listAudit(opts: { page?: number; pageSize?: number; action?: string; userId?: number } = {}) {
  const page = Math.max(1, Math.floor(opts.page ?? 1));
  const pageSize = Math.min(200, Math.max(1, Math.floor(opts.pageSize ?? 20)));
  const where: string[] = [];
  const args: Array<string | number> = [];
  if (opts.action) {
    where.push('action = ?');
    args.push(opts.action);
  }
  if (typeof opts.userId === 'number') {
    where.push('userId = ?');
    args.push(opts.userId);
  }
  const cond = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const total = (db.prepare(`SELECT COUNT(*) AS n FROM audit_logs ${cond}`).get(...args) as { n: number }).n;
  const rows = db
    .prepare(`SELECT * FROM audit_logs ${cond} ORDER BY createdAt DESC, id DESC LIMIT ? OFFSET ?`)
    .all(...args, pageSize, (page - 1) * pageSize) as AuditEntry[];
  return { rows, total, page, pageSize, pageCount: Math.max(1, Math.ceil(total / pageSize)) };
}

/** 清空审计日志；keepDays > 0 时只保留最近 N 天 */
export function clearAudit(keepDays = 0): number {
  const before = keepDays > 0 ? Date.now() - keepDays * 86_400_000 : Date.now() + 1;
  return db.prepare('DELETE FROM audit_logs WHERE createdAt < ?').run(before).changes;
}
