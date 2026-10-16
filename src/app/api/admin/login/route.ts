import { cookies } from "next/headers";
import { ok } from "@/lib/response";
import { adminLoginSchema } from "@/lib/validation";
import { loginWithPassword, setSessionCookie } from "@/server/auth";
import { handle, json, parseOrThrow } from "../../_lib/http";

export const runtime = "nodejs";

/** POST /api/admin/login 登录（契约 §4.1，成功下发 HttpOnly 会话 Cookie） */
export async function POST(req: Request) {
  return handle(async () => {
    const raw = await req.json().catch(() => null);
    const { username, password } = parseOrThrow(adminLoginSchema, raw);
    const { session, token } = await loginWithPassword(username, password);
    const store = await cookies();
    setSessionCookie(store, token, session.expiresAt);
    return json(ok({ username: session.username, expiresAt: session.expiresAt }));
  });
}
