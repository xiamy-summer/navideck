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

function createConnection() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
  const db = new Database(path.join(DATA_DIR, 'nav.db'));
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  // 构建期多个 worker 会并发打开同一个库，等待而不是直接抛 SQLITE_BUSY
  db.pragma('busy_timeout = 8000');
  migrate(db);
  return db;
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

export const db: Database.Database = globalForDb.__navDb ?? createConnection();
if (process.env.NODE_ENV !== 'production') globalForDb.__navDb = db;

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

export { UPLOAD_DIR };
