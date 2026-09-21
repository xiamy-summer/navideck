import { NextResponse } from 'next/server';
import { AuthError, getCurrentUser } from './auth';
import { getUserById } from './db';
import type { User } from './types';

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data, init);
}

export function fail(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof AuthError) return fail(err.message, err.status);
    const message = err instanceof Error ? err.message : '服务器内部错误';
    return fail(message, 500);
  }
}

export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new Error('请求体不是合法 JSON');
  }
}

export interface Target {
  /** 当前登录用户（可能为 null） */
  actor: User | null;
  /** 实际读写的数据归属用户 */
  owner: User;
}

/**
 * 解析操作目标：
 * - 登录用户默认操作自己的数据
 * - 管理员可通过 ?as=<userId> 代管其他账号（含访客账号）的数据
 */
export async function resolveTarget(req: Request): Promise<Target> {
  const actor = await getCurrentUser();
  const url = new URL(req.url);
  const as = url.searchParams.get('as');
  if (as && actor?.role === 'admin') {
    const owner = getUserById(Number(as));
    if (owner) return { actor, owner };
  }
  if (as && !actor) {
    // 未登录时允许显式指定访客账号读取
    const owner = getUserById(Number(as));
    if (owner && owner.role === 'guest') return { actor: null, owner };
  }
  if (!actor) throw new AuthError('未登录', 401);
  return { actor, owner: actor };
}

export function requireWrite(target: Target) {
  if (!target.actor) throw new AuthError('未登录', 401);
  if (target.owner.role === 'guest' && target.actor.role !== 'admin') {
    throw new AuthError('访客内容仅管理员可编辑', 403);
  }
  if (target.owner.id !== target.actor.id && target.actor.role !== 'admin') {
    throw new AuthError('无权修改他人数据', 403);
  }
}

export function requireAdmin(target: Target) {
  if (target.actor?.role !== 'admin') throw new AuthError('需要管理员权限', 403);
}
