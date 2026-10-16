import { ok } from "@/lib/response";
import { handle, json, requireAdmin } from "../../_lib/http";

export const runtime = "nodejs";

/** GET /api/admin/session 当前登录态（契约 §4.3，前端路由守卫用） */
export async function GET() {
  return handle(async () => {
    const session = await requireAdmin();
    return json(ok({ username: session.username, expiresAt: session.expiresAt }));
  });
}
