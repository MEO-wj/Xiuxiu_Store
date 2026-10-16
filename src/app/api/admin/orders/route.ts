import { ok } from "@/lib/response";
import { orderListQuerySchema } from "@/lib/validation";
import { listOrders } from "@/server/order-service";
import { handle, json, parseOrThrow, requireAdmin, searchParamsToObject } from "../../_lib/http";

export const runtime = "nodejs";

/** GET /api/admin/orders 订单列表（契约 §4.4：状态/手机号/通知状态/时间范围 + 分页） */
export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const query = parseOrThrow(orderListQuerySchema, searchParamsToObject(req));
    const data = await listOrders(query);
    return json(ok(data));
  });
}
