import { ok } from "@/lib/response";
import { orderUpdateSchema } from "@/lib/validation";
import { getOrderDetail, updateOrder } from "@/server/order-service";
import { handle, json, parseOrThrow, requireAdmin } from "../../../_lib/http";

export const runtime = "nodejs";

/** GET /api/admin/orders/{id} 订单详情（含关联售后，契约 §4.5） */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await params;
    const data = await getOrderDetail(id);
    return json(ok(data));
  });
}

/** PATCH /api/admin/orders/{id} 改状态 / 备注 / 最终价格（契约 §4.6，非法或需备注未填 → 40006） */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await params;
    const raw = await req.json().catch(() => null);
    const patch = parseOrThrow(orderUpdateSchema, raw);
    const data = await updateOrder(id, patch);
    return json(ok(data));
  });
}
