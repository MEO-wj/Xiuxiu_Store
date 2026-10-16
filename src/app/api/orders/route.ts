import { ok } from "@/lib/response";
import { createOrder } from "@/server/order-service";
import { handle, json } from "../_lib/http";

export const runtime = "nodejs";

/** POST /api/orders 提交订单（契约 §3.1） */
export async function POST(req: Request) {
  return handle(async () => {
    const raw = await req.json().catch(() => null);
    const { result } = await createOrder(raw);
    return json(ok(result));
  });
}
