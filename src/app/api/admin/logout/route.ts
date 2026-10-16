import { cookies } from "next/headers";
import { ok } from "@/lib/response";
import { clearSessionCookie } from "@/server/auth";
import { handle, json, requireAdmin } from "../../_lib/http";

export const runtime = "nodejs";

/** POST /api/admin/logout 退出登录（契约 §4.2） */
export async function POST() {
  return handle(async () => {
    await requireAdmin();
    const store = await cookies();
    clearSessionCookie(store);
    return json(ok(null));
  });
}
