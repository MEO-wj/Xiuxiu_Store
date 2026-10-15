/**
 * 后台鉴权：bcrypt 校验 + jose HS256 JWT（SESSION_SECRET，8h）+
 * HttpOnly / SameSite=Lax / Secure(生产) Cookie + 登录失败锁定（内存态）。
 *
 * 口径：API 契约 §1.5（鉴权）、§4.1（登录）；开发文档 §5.6。
 * - Cookie 名 xiuxiu_session，有效期 8 小时（Max-Age=28800）
 * - 同一账号连续 5 次失败锁定 10 分钟（40001 + 提示稍后重试）
 * - 账号不存在与密码错误返回同一文案（防用户名枚举）
 * - 登录成功更新 admin_users.last_login_at
 */
import { compare } from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import type { cookies } from "next/headers";

import { ErrorCode, LOGIN_LOCK_MS, LOGIN_MAX_FAILURES, SESSION_COOKIE, SESSION_TTL_MS } from "@/lib/constants";
import { ServiceError } from "@/lib/response";
import type { SessionInfo } from "@/lib/types";

import { prisma } from "./db";

// ─── JWT ─────────────────────────────────────────────────────────────────────

function sessionSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 16) {
    // 生产缺密钥直接拒绝签发（不静默使用弱密钥）
    throw new ServiceError(ErrorCode.INTERNAL, "服务端配置缺失：SESSION_SECRET");
  }
  return new TextEncoder().encode(secret);
}

export type SessionPayload = {
  username: string;
};

/** 签发会话 JWT（HS256，8h） */
export async function signSession(
  payload: SessionPayload,
  now: Date = new Date(),
): Promise<{ token: string; expiresAt: Date }> {
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  const token = await new SignJWT({ username: payload.username })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(Math.floor(now.getTime() / 1000))
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(sessionSecret());
  return { token, expiresAt };
}

/** 校验 JWT 并返回会话信息；无效/过期返回 null（不抛错，调用方转 40100） */
export async function verifySessionToken(token: string): Promise<SessionInfo | null> {
  try {
    const { payload } = await jwtVerify(token, sessionSecret(), { algorithms: ["HS256"] });
    const username = typeof payload.username === "string" ? payload.username : null;
    const exp = typeof payload.exp === "number" ? payload.exp : null;
    if (!username || !exp) return null;
    return { username, expiresAt: new Date(exp * 1000) };
  } catch {
    return null;
  }
}

// ─── Cookie 读写（Next.js cookies() API；生产 Secure） ────────────────────────

/** Next.js 15：cookies() 返回 Promise（异步 API） */
export type CookieStore = Awaited<ReturnType<typeof cookies>>;

/** Cookie 属性（契约 §4.1 Set-Cookie：HttpOnly; SameSite=Lax; Path=/; Max-Age=28800） */
export function sessionCookieOptions(expiresAt: Date) {
  return {
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true as const,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
    maxAge: Math.floor(SESSION_TTL_MS / 1000), // 28800
  };
}

/** 登录成功后写入会话 Cookie（在 Route Handler 中调用） */
export function setSessionCookie(
  store: CookieStore,
  token: string,
  expiresAt: Date,
): void {
  store.set({ ...sessionCookieOptions(expiresAt), value: token });
}

/** 登出/失效时清除会话 Cookie */
export function clearSessionCookie(store: CookieStore): void {
  store.set({
    name: SESSION_COOKIE,
    value: "",
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 0,
  });
}

/**
 * 当前会话（供路由与 middleware 复用）。
 * @returns 有效会话信息；未登录/过期返回 null
 */
export async function getSession(store?: CookieStore): Promise<SessionInfo | null> {
  const token = store?.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

// ─── 登录失败计数（内存态，进程级；单店单实例足够，契约 §1.5「技术防护」） ────────

type FailureRecord = { count: number; lockedUntil: number };

const globalForAuth = globalThis as unknown as {
  __xiuxiuLoginFailures?: Map<string, FailureRecord>;
};
const loginFailures: Map<string, FailureRecord> =
  globalForAuth.__xiuxiuLoginFailures ?? new Map<string, FailureRecord>();
globalForAuth.__xiuxiuLoginFailures = loginFailures;

/** 当前是否处于锁定（供路由层与验证脚本用） */
export function isLoginLocked(username: string, now: Date = new Date()): boolean {
  const rec = loginFailures.get(username);
  return !!rec && rec.lockedUntil > now.getTime();
}

/** 测试辅助：清空失败计数 */
export function resetLoginFailures(): void {
  loginFailures.clear();
}

function registerFailure(username: string, now: Date): void {
  const rec = loginFailures.get(username) ?? { count: 0, lockedUntil: 0 };
  if (rec.lockedUntil <= now.getTime()) {
    // 锁定期结束，重新计数
    rec.count = 0;
    rec.lockedUntil = 0;
  }
  rec.count += 1;
  if (rec.count >= LOGIN_MAX_FAILURES) {
    rec.lockedUntil = now.getTime() + LOGIN_LOCK_MS;
    rec.count = 0; // 锁定后清零，解锁后重新累计
  }
  loginFailures.set(username, rec);
}

/** 登录失败锁定提示文案（契约 §1.5：返回 40001，message 提示稍后重试） */
export const LOGIN_LOCKED_MESSAGE = "失败次数过多，请 10 分钟后再试";
/** 账号或密码错误文案（同一文案防枚举，契约 §4.1 安全要求） */
export const LOGIN_FAILED_MESSAGE = "账号或密码错误";

// ─── 登录（service 层完整流程） ───────────────────────────────────────────────

export type LoginResult = {
  session: SessionInfo;
  token: string;
};

// 恒定时间比较：账号不存在时仍执行一次 bcrypt.compare（dummy hash），防用户名枚举
const DUMMY_HASH = "$2b$10$CwTycUXWue0Thq9StjUM0uJ8.PxHqXn5rj1F9Yx2sQeQ7zHqjLqPe";

/**
 * 校验账号密码并签发会话。
 * - 锁定中 → 40001 + 稍后重试文案
 * - 账号不存在 / 密码错误 → 40001 + 同一文案（防枚举）
 * - 成功 → 清空失败计数、更新 last_login_at、返回 JWT 与过期时刻
 */
export async function loginWithPassword(
  username: string,
  password: string,
  now: Date = new Date(),
): Promise<LoginResult> {
  if (isLoginLocked(username, now)) {
    throw new ServiceError(ErrorCode.BAD_REQUEST, LOGIN_LOCKED_MESSAGE);
  }

  const user = await prisma.adminUser.findUnique({ where: { username } });
  const hashToCompare = user?.passwordHash ?? DUMMY_HASH;
  // bcryptjs 对非法哈希格式会抛错，吞掉后统一走失败分支
  let passwordOk = false;
  try {
    passwordOk = await compare(password, hashToCompare);
  } catch {
    passwordOk = false;
  }

  if (!user || !passwordOk) {
    registerFailure(username, now);
    throw new ServiceError(ErrorCode.BAD_REQUEST, LOGIN_FAILED_MESSAGE);
  }

  loginFailures.delete(username);
  await prisma.adminUser.update({
    where: { id: user.id },
    data: { lastLoginAt: now },
  });

  const { token, expiresAt } = await signSession({ username: user.username }, now);
  return { session: { username: user.username, expiresAt }, token };
}
