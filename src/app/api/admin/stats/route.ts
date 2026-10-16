import { ok } from "@/lib/response";
import { shanghaiDayRange } from "@/lib/format";
import { prisma } from "@/server/db";
import { handle, json, requireAdmin } from "../../_lib/http";

export const runtime = "nodejs";

/** GET /api/admin/stats 简单统计（契约 §4.11，可选功能） */
export async function GET() {
  return handle(async () => {
    await requireAdmin();
    const now = new Date();
    const { start } = shanghaiDayRange(now);
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [todayOrders, weekDone, pendingCount, notifyFailedCount] = await Promise.all([
      prisma.order.count({ where: { createdAt: { gte: start } } }),
      prisma.order.count({ where: { status: "done", updatedAt: { gte: weekAgo } } }),
      prisma.order.count({ where: { status: "pending" } }),
      prisma.order.count({ where: { notifyStatus: "failed" } }),
    ]);

    return json(ok({ todayOrders, weekDone, pendingCount, notifyFailedCount }));
  });
}
