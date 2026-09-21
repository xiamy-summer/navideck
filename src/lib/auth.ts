import { cookies } from 'next/headers';
import { SignJWT, jwtVerify } from 'jose';
import { getAuthUser, getUserById } from './db';
import type { Role, User } from './types';

const SECRET = new TextEncoder().encode(
  process.env.JWT_SECRET || 'nas-nav-dev-secret-please-change-in-production',
);
export const COOKIE_NAME = 'nas-nav-token';
const MAX_AGE = 60 * 60 * 24 * 7;

export interface SessionPayload {
  uid: number;
  username: string;
  role: Role;
  tv: number;
}

export async function signToken(user: { id: number; username: string; role: Role; tokenVersion?: number }) {
  return new SignJWT({ username: user.username, role: user.role, tv: user.tokenVersion ?? 1 })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(String(user.id))
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE}s`)
    .sign(SECRET);
}

export async function verifyToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, SECRET);
    const uid = Number(payload.sub);
    if (!uid) return null;
    return {
      uid,
      username: String(payload.username ?? ''),
      role: (payload.role as Role) ?? 'user',
      tv: Number(payload.tv ?? 1),
    };
  } catch {
    return null;
  }
}

export async function setSessionCookie(token: string) {
  const store = await cookies();
  store.set(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: MAX_AGE,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.set(COOKIE_NAME, '', { httpOnly: true, path: '/', maxAge: 0 });
}

/** 读取当前登录用户（未登录返回 null） */
export async function getCurrentUser(): Promise<User | null> {
  const store = await cookies();
  const token = store.get(COOKIE_NAME)?.value;
  if (!token) return null;
  const payload = await verifyToken(token);
  if (!payload) return null;
  const row = getAuthUser(payload.username);
  if (!row || row.id !== payload.uid) return null;
  if ((row.tokenVersion ?? 1) !== payload.tv) return null;
  return getUserById(row.id);
}

/** 要求登录，未登录抛错由调用方处理 */
export async function requireUser(): Promise<User> {
  const user = await getCurrentUser();
  if (!user) throw new AuthError('未登录', 401);
  return user;
}

export class AuthError extends Error {
  status: number;
  constructor(message: string, status = 401) {
    super(message);
    this.status = status;
  }
}

export function isAdmin(user: User | null): boolean {
  return user?.role === 'admin';
}
