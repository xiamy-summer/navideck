import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {
  DEFAULT_SETTINGS,
  type Group,
  type Item,
  type OpenMode,
  type Role,
  type Settings,
  type UploadedFile,
  type User,
  type UserRow,
} from './types';

const DATA_DIR = process.env.DATA_DIR || path.join(process.cwd(), '.data');
const UPLOAD_DIR = path.join(DATA_DIR, 'uploads');
const BACKUP_DIR = path.join(DATA_DIR, 'backups');
const LAST_BACKUP_FILE = path.join(DATA_DIR, '.lastbackup');

function createConnection(): Database.Database {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const conn = new Database(path.join(DATA_DIR, 'nav.db'));
  conn.pragma('journal_mode = WAL');
  conn.pragma('foreign_keys = ON');
  // 构建期多个 worker 会并发打开同一个库，等待而不是直接抛 SQLITE_BUSY
  conn.pragma('busy_timeout = 8000');
  migrate(conn);
  globalForDb.__navDb = conn;
  return conn;
}

function migrate(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT NOT NULL UNIQUE,
      passwordHash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user',
      avatar TEXT,
      tokenVersion INTEGER NOT NULL DEFAULT 1,
      createdAt INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      name TEXT NOT NULL,
      icon TEXT,
      sort INTEGER NOT NULL DEFAULT 0,
      createdAt INTEGER NOT NULL,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      groupId INTEGER NOT NULL,
      userId INTEGER NOT NULL,
      title TEXT NOT NULL,
      icon TEXT,
      urlLan TEXT NOT NULL DEFAULT '',
      urlWan TEXT NOT NULL DEFAULT '',
      desc TEXT,
      openMode TEXT NOT NULL DEFAULT 'blank',
      color TEXT,
      sort INTEGER NOT NULL DEFAULT 0,
      createdAt INTEGER NOT NULL,
      FOREIGN KEY (groupId) REFERENCES groups(id) ON DELETE CASCADE,
      FOREIGN KEY (userId) REFERENCES users(id) ON DELETE CASCADE
    );
    CREATE TABLE IF NOT EXISTS settings (
      userId INTEGER PRIMARY KEY,
      data TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      userId INTEGER NOT NULL,
      hash TEXT NOT NULL,
      name TEXT NOT NULL,
      mime TEXT NOT NULL,
      size INTEGER NOT NULL,
      path TEXT NOT NULL,
      refCount INTEGER NOT NULL DEFAULT 1,
      createdAt INTEGER NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_groups_user ON groups(userId, sort);
    CREATE INDEX IF NOT EXISTS idx_items_group ON items(groupId, sort);
    CREATE INDEX IF NOT EXISTS idx_files_hash ON files(hash);
  `);
}

const globalForDb = globalThis as unknown as { __navDb?: Database.Database };

/**
 * 懒加载数据库连接：首次访问时才真正打开文件。
 * 这样 `next build` 的页面数据收集阶段（多个 worker 并发导入模块）不会触碰磁盘文件，
 * 避免构建期 SQLITE_BUSY；运行时首次请求才创建连接。
 */
function getDbConnection(): Database.Database {
  if (!globalForDb.__navDb) createConnection();
  return globalForDb.__navDb!;
}

export let db: Database.Database = new Proxy({} as Database.Database, {
  get(_t, prop) {
    const conn = getDbConnection();
    const v = (conn as unknown as Record<PropertyKey, unknown>)[prop];
    return typeof v === 'function' ? (v as (...a: unknown[]) => unknown).bind(conn) : v;
  },
  set(_t, prop, value) {
    (getDbConnection() as unknown as Record<PropertyKey, unknown>)[prop] = value;
    return true;
  },
});

/** 关闭并重新打开数据库连接（用于备份恢复后热加载） */
export function reloadDatabase() {
  try {
    db.close();
  } catch {
    /* 忽略关闭异常 */
  }
  // 丢弃代理，重新指向一个真实连接
  db = createConnection();
}

/* ------------------------------ 密码 ------------------------------ */

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${derived}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt, key] = String(stored || '').split(':');
  if (!salt || !key) return false;
  const derived = crypto.scryptSync(password, salt, 64);
  const expected = Buffer.from(key, 'hex');
  if (expected.length !== derived.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

/* ------------------------------ 用户 ------------------------------ */

export function countUsers(): number {
  const row = db.prepare('SELECT COUNT(*) AS c FROM users').get() as { c: number };
  return row.c;
}

export function createUser(username: string, password: string, role: Role = 'user'): User {
  const info = db
    .prepare(
      'INSERT INTO users (username, passwordHash, role, avatar, tokenVersion, createdAt) VALUES (?, ?, ?, NULL, 1, ?)',
    )
    .run(username, hashPassword(password), role, Date.now());
  return getUserById(Number(info.lastInsertRowid))!;
}

export function getUserById(id: number): User | null {
  const row = db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
  return row ? toUser(row) : null;
}

export function getUserByName(username: string): User | null {
  const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as UserRow | undefined;
  return row ? toUser(row) : null;
}

export function getAuthUser(username: string): UserRow | null {
  const row = db.prepare('SELECT * FROM users WHERE username = ?').get(username) as UserRow | undefined;
  return row ?? null;
}

export function listUsers(): User[] {
  const rows = db.prepare('SELECT * FROM users ORDER BY id').all() as UserRow[];
  return rows.map(toUser);
}

export function updateUser(
  id: number,
  patch: { username?: string; password?: string; role?: Role; avatar?: string | null },
): User | null {
  const sets: string[] = [];
  const args: unknown[] = [];
  if (patch.username !== undefined) {
    sets.push('username = ?');
    args.push(patch.username);
  }
  if (patch.password) {
    sets.push('passwordHash = ?', 'tokenVersion = tokenVersion + 1');
    args.push(hashPassword(patch.password));
  }
  if (patch.role !== undefined) {
    sets.push('role = ?');
    args.push(patch.role);
  }
  if (patch.avatar !== undefined) {
    sets.push('avatar = ?');
    args.push(patch.avatar);
  }
  if (!sets.length) return getUserById(id);
  args.push(id);
  db.prepare(`UPDATE users SET ${sets.join(', ')} WHERE id = ?`).run(...args);
  return getUserById(id);
}

export function bumpTokenVersion(id: number) {
  db.prepare('UPDATE users SET tokenVersion = tokenVersion + 1 WHERE id = ?').run(id);
}

export function deleteUser(id: number) {
  db.prepare('DELETE FROM users WHERE id = ?').run(id);
  db.prepare('DELETE FROM settings WHERE userId = ?').run(id);
  db.prepare('DELETE FROM files WHERE userId = ? AND refCount <= 1').run(id);
}

function toUser(row: UserRow): User {
  return {
    id: row.id,
    username: row.username,
    role: row.role,
    avatar: row.avatar,
    createdAt: row.createdAt,
  };
}

/* ------------------------------ 分组 ------------------------------ */

export function listGroups(userId: number): Group[] {
  return db
    .prepare('SELECT * FROM groups WHERE userId = ? ORDER BY sort ASC, id ASC')
    .all(userId) as Group[];
}

export function createGroup(userId: number, name: string, icon: string | null = null): Group {
  const next = db.prepare('SELECT COALESCE(MAX(sort), 0) + 1 AS s FROM groups WHERE userId = ?').get(userId) as {
    s: number;
  };
  const info = db
    .prepare('INSERT INTO groups (userId, name, icon, sort, createdAt) VALUES (?, ?, ?, ?, ?)')
    .run(userId, name, icon, next.s, Date.now());
  return db.prepare('SELECT * FROM groups WHERE id = ?').get(info.lastInsertRowid) as Group;
}

export function updateGroup(userId: number, id: number, patch: { name?: string; icon?: string | null; sort?: number }) {
  const owned = db.prepare('SELECT id FROM groups WHERE id = ? AND userId = ?').get(id, userId);
  if (!owned) return null;
  const sets: string[] = [];
  const args: unknown[] = [];
  if (patch.name !== undefined) {
    sets.push('name = ?');
    args.push(patch.name);
  }
  if (patch.icon !== undefined) {
    sets.push('icon = ?');
    args.push(patch.icon);
  }
  if (patch.sort !== undefined) {
    sets.push('sort = ?');
    args.push(patch.sort);
  }
  if (!sets.length) return null;
  args.push(id);
  db.prepare(`UPDATE groups SET ${sets.join(', ')} WHERE id = ?`).run(...args);
  return db.prepare('SELECT * FROM groups WHERE id = ?').get(id) as Group;
}

export function deleteGroup(userId: number, id: number) {
  const info = db.prepare('DELETE FROM groups WHERE id = ? AND userId = ?').run(id, userId);
  return info.changes > 0;
}

/* ------------------------------ 站点 ------------------------------ */

export function listItems(userId: number): Item[] {
  return db
    .prepare(
      `SELECT i.* FROM items i
       JOIN groups g ON g.id = i.groupId
       WHERE i.userId = ? ORDER BY i.sort ASC, i.id ASC`,
    )
    .all(userId) as Item[];
}

export function listItemsByGroup(userId: number, groupId: number): Item[] {
  return db
    .prepare('SELECT * FROM items WHERE groupId = ? AND userId = ? ORDER BY sort ASC, id ASC')
    .all(groupId, userId) as Item[];
}

export function createItem(
  userId: number,
  input: Partial<Item> & { groupId: number; title: string },
): Item {
  const owned = db.prepare('SELECT id FROM groups WHERE id = ? AND userId = ?').get(input.groupId, userId);
  if (!owned) throw new Error('分组不存在或无权访问');
  const next = db
    .prepare('SELECT COALESCE(MAX(sort), 0) + 1 AS s FROM items WHERE groupId = ?')
    .get(input.groupId) as { s: number };
  const info = db
    .prepare(
      `INSERT INTO items (groupId, userId, title, icon, urlLan, urlWan, desc, openMode, color, sort, createdAt)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.groupId,
      userId,
      input.title,
      input.icon ?? null,
      input.urlLan ?? '',
      input.urlWan ?? '',
      input.desc ?? null,
      (input.openMode ?? 'blank') as OpenMode,
      input.color ?? null,
      next.s,
      Date.now(),
    );
  return db.prepare('SELECT * FROM items WHERE id = ?').get(info.lastInsertRowid) as Item;
}

export function updateItem(
  userId: number,
  id: number,
  patch: Partial<Pick<Item, 'title' | 'icon' | 'urlLan' | 'urlWan' | 'desc' | 'openMode' | 'color' | 'sort' | 'groupId'>>,
): Item | null {
  const owned = db.prepare('SELECT id FROM items WHERE id = ? AND userId = ?').get(id, userId);
  if (!owned) return null;
  const map: Record<string, string> = {
    title: 'title',
    icon: 'icon',
    urlLan: 'urlLan',
    urlWan: 'urlWan',
    desc: 'desc',
    openMode: 'openMode',
    color: 'color',
    sort: 'sort',
    groupId: 'groupId',
  };
  const sets: string[] = [];
  const args: unknown[] = [];
  for (const [key, column] of Object.entries(map)) {
    const value = (patch as Record<string, unknown>)[key];
    if (value !== undefined) {
      sets.push(`${column} = ?`);
      args.push(value);
    }
  }
  if (!sets.length) return null;
  args.push(id);
  db.prepare(`UPDATE items SET ${sets.join(', ')} WHERE id = ?`).run(...args);
  return db.prepare('SELECT * FROM items WHERE id = ?').get(id) as Item;
}

export function deleteItem(userId: number, id: number) {
  const info = db.prepare('DELETE FROM items WHERE id = ? AND userId = ?').run(id, userId);
  return info.changes > 0;
}

/* ------------------------------ 排序 ------------------------------ */

export function reorderGroups(userId: number, orderedIds: number[]) {
  const stmt = db.prepare('UPDATE groups SET sort = ? WHERE id = ? AND userId = ?');
  const tx = db.transaction((ids: number[]) => {
    ids.forEach((id, index) => stmt.run(index, id, userId));
  });
  tx(orderedIds);
}

export function reorderItems(userId: number, groupId: number, orderedIds: number[]) {
  const stmt = db.prepare('UPDATE items SET sort = ? WHERE id = ? AND groupId = ? AND userId = ?');
  const tx = db.transaction((ids: number[]) => {
    ids.forEach((id, index) => stmt.run(index, id, groupId, userId));
  });
  tx(orderedIds);
}

/* ------------------------------ 设置 ------------------------------ */

function readSettingsRow(userId: number): Partial<Settings> {
  const row = db.prepare('SELECT data FROM settings WHERE userId = ?').get(userId) as
    | { data: string }
    | undefined;
  if (!row) return {};
  try {
    return JSON.parse(row.data) as Partial<Settings>;
  } catch {
    return {};
  }
}

export function getGlobalSettings(): Settings {
  return { ...DEFAULT_SETTINGS, ...readSettingsRow(0) };
}

export function getUserSettings(userId: number): Settings {
  return { ...DEFAULT_SETTINGS, ...readSettingsRow(0), ...readSettingsRow(userId) };
}

export function saveUserSettings(userId: number, patch: Partial<Settings>): Settings {
  const current = readSettingsRow(userId);
  const merged = { ...current, ...patch };
  db.prepare(
    'INSERT INTO settings (userId, data) VALUES (?, ?) ON CONFLICT(userId) DO UPDATE SET data = excluded.data',
  ).run(userId, JSON.stringify(merged));
  return getUserSettings(userId);
}

export function resetUserSettings(userId: number): Settings {
  db.prepare('DELETE FROM settings WHERE userId = ?').run(userId);
  return getUserSettings(userId);
}

/* ------------------------------ 文件池 ------------------------------ */

export function findFileByHash(hash: string): UploadedFile | null {
  const row = db.prepare('SELECT * FROM files WHERE hash = ?').get(hash) as UploadedFile | undefined;
  return row ?? null;
}

export function addFileRecord(
  userId: number,
  file: { hash: string; name: string; mime: string; size: number; path: string },
): UploadedFile {
  const info = db
    .prepare(
      'INSERT INTO files (userId, hash, name, mime, size, path, refCount, createdAt) VALUES (?, ?, ?, ?, ?, ?, 1, ?)',
    )
    .run(userId, file.hash, file.name, file.mime, file.size, file.path, Date.now());
  return db.prepare('SELECT * FROM files WHERE id = ?').get(info.lastInsertRowid) as UploadedFile;
}

export function bumpFileRef(id: number) {
  db.prepare('UPDATE files SET refCount = refCount + 1 WHERE id = ?').run(id);
}

export function listFiles(userId: number): UploadedFile[] {
  return db.prepare('SELECT * FROM files WHERE userId = ? ORDER BY createdAt DESC').all(userId) as UploadedFile[];
}

export function deleteFile(userId: number, id: number): UploadedFile | null {
  const row = db.prepare('SELECT * FROM files WHERE id = ? AND userId = ?').get(id, userId) as
    | UploadedFile
    | undefined;
  if (!row) return null;
  db.prepare('DELETE FROM files WHERE id = ?').run(id);
  return row;
}

/* ------------------------------ 数据备份 ------------------------------ */

export interface BackupInfo {
  name: string;
  size: number;
  createdAt: number;
}

export function listBackups(): BackupInfo[] {
  if (!fs.existsSync(BACKUP_DIR)) return [];
  return fs
    .readdirSync(BACKUP_DIR)
    .filter((f) => f.startsWith('nav-') && f.endsWith('.db'))
    .map((f) => {
      const stat = fs.statSync(path.join(BACKUP_DIR, f));
      // 文件名格式 nav-YYYYMMDDHHMMSS.db（14 位时间戳）
      const stamp = f.slice(4, 18);
      const createdAt = Number.isFinite(Number(stamp))
        ? new Date(
            `${stamp.slice(0, 4)}-${stamp.slice(4, 6)}-${stamp.slice(6, 8)}T${stamp.slice(8, 10)}:${stamp.slice(
              10,
              12,
            )}:${stamp.slice(12, 14)}`,
          ).getTime()
        : stat.mtimeMs;
      return { name: f, size: stat.size, createdAt: Number.isFinite(createdAt) ? createdAt : stat.mtimeMs };
    })
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** 立即对 nav.db 做一次快照（先 checkpoint 保证数据落盘） */
export function createBackup(): BackupInfo {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  try {
    db.pragma('wal_checkpoint(TRUNCATE)');
  } catch {
    /* 忽略 */
  }
  const d = new Date();
  const p2 = (n: number) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${p2(d.getMonth() + 1)}${p2(d.getDate())}${p2(d.getHours())}${p2(
    d.getMinutes(),
  )}${p2(d.getSeconds())}`;
  const dest = path.join(BACKUP_DIR, `nav-${stamp}.db`);
  fs.copyFileSync(path.join(DATA_DIR, 'nav.db'), dest);
  const stat = fs.statSync(dest);
  writeLastBackup(Date.now());
  return { name: path.basename(dest), size: stat.size, createdAt: Date.now() };
}

export function deleteBackup(name: string): boolean {
  const safe = path.basename(name);
  if (!safe.startsWith('nav-') || !safe.endsWith('.db')) return false;
  const p = path.join(BACKUP_DIR, safe);
  if (!fs.existsSync(p)) return false;
  fs.unlinkSync(p);
  return true;
}

/** 从备份恢复：覆盖 nav.db 后热重载连接 */
export function restoreBackup(name: string): boolean {
  const safe = path.basename(name);
  if (!safe.startsWith('nav-') || !safe.endsWith('.db')) return false;
  const src = path.join(BACKUP_DIR, safe);
  if (!fs.existsSync(src)) return false;
  fs.copyFileSync(src, path.join(DATA_DIR, 'nav.db'));
  // 清除旧的 WAL/SHM，避免与新库状态冲突
  for (const ext of ['-wal', '-shm']) {
    try {
      fs.unlinkSync(path.join(DATA_DIR, `nav.db${ext}`));
    } catch {
      /* 不存在则忽略 */
    }
  }
  reloadDatabase();
  return true;
}

function readLastBackup(): number {
  try {
    return Number(fs.readFileSync(LAST_BACKUP_FILE, 'utf8').trim()) || 0;
  } catch {
    return 0;
  }
}

function writeLastBackup(ts: number) {
  try {
    fs.writeFileSync(LAST_BACKUP_FILE, String(ts));
  } catch {
    /* 忽略 */
  }
}

/** 定时自动备份：按全局设置 backupInterval（小时）周期执行，模块加载时启动一次 */
export function startBackupScheduler() {
  const g = globalThis as unknown as { __navBackupTimer?: ReturnType<typeof setInterval> };
  if (g.__navBackupTimer) return;
  g.__navBackupTimer = setInterval(
    () => {
      try {
        const interval = getGlobalSettings().backupInterval;
        if (!interval || interval <= 0) return;
        const last = readLastBackup();
        const due = Date.now() - last >= interval * 3600 * 1000;
        if (due) createBackup();
      } catch {
        /* 静默失败，下次重试 */
      }
    },
    60 * 1000,
  );
  // 不阻止进程退出
  if (typeof g.__navBackupTimer.unref === 'function') g.__navBackupTimer.unref();
}

// 服务端启动时尝试开启自动备份调度
if (typeof setInterval !== 'undefined') {
  try {
    startBackupScheduler();
  } catch {
    /* 忽略 */
  }
}

export { UPLOAD_DIR, DATA_DIR, BACKUP_DIR };
