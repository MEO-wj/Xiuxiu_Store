import { ok } from "@/lib/response";
import { getOrderPublicSummary } from "@/server/order-service";
import { handle, json } from "../../_lib/http";

export const runtime = "nodejs";

/** GET /api/orders/{id} 成功页脱敏摘要（契约 §3.4：不含 status/手机号/联系人/地址/描述/照片） */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    const { id } = await params;
    const data = await getOrderPublicSummary(id);
    return json(ok(data));
  });
}
