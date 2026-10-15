import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import type { ZodType } from "zod";
import { ErrorCode, SESSION_COOKIE } from "@/lib/constants";
import { ServiceError, internalFail } from "@/lib/response";
import type { FieldError, SessionInfo } from "@/lib/types";
import { getSession } from "@/server/auth";

export const NODE_RUNTIME = "nodejs" as const;

export function json<T>(payload: T, status = 200): NextResponse {
  return NextResponse.json(payload, { status });
}

/** 统一异常收敛：ServiceError → 对应 code/status；未知异常 → 50000（不泄露堆栈） */
export async function handle(fn: () => Promise<NextResponse>): Promise<NextResponse> {
  try {
    return await fn();
  } catch (e) {
    if (e instanceof ServiceError) return json(e.toResponse(), e.httpStatus);
    console.error("[api] 未处理异常:", e);
    return json(internalFail(), 500);
  }
}

/** 后台接口鉴权：未登录抛 40100（接口返回 JSON，不做 302） */
export async function requireAdmin(): Promise<SessionInfo> {
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  const session = token ? await getSession(store) : null;
  if (!session) throw new ServiceError(ErrorCode.UNAUTHORIZED);
  return session;
}

/** 入参校验：ZodError → 40001 字段级错误（契约 §1.4） */
export function parseOrThrow<T>(schema: ZodType<T>, raw: unknown): T {
  const parsed = schema.safeParse(raw);
  if (parsed.success) return parsed.data;
  const fields: FieldError[] = parsed.error.issues.map((issue) => ({
    field: issue.path.join(".") || "body",
    message: issue.message,
  }));
  throw new ServiceError(ErrorCode.BAD_REQUEST, undefined, fields);
}

/** query string → 对象（丢弃空值，保留契约默认值语义） */
export function searchParamsToObject(req: Request): Record<string, string> {
  const out: Record<string, string> = {};
  new URL(req.url).searchParams.forEach((value, key) => {
    if (value !== "") out[key] = value;
  });
  return out;
}

/**
 * 请求来源 IP（用于上传限流）。
 * 仅当 TRUST_PROXY=1（部署在 Nginx 等受信反向代理之后）时才信任 X-Forwarded-For，
 * 否则该头可被客户端伪造，导致限流被绕过。
 */
export function clientIp(req: Request): string {
  if (process.env.TRUST_PROXY === "1") {
    const forwarded = req.headers.get("x-forwarded-for");
    if (forwarded) return forwarded.split(",")[0]!.trim();
  }
  return req.headers.get("x-real-ip") ?? "local";
}
