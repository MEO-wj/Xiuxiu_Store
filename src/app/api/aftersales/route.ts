import { ok } from "@/lib/response";
import { createAftersale } from "@/server/aftersale-service";
import { handle, json } from "../_lib/http";

export const runtime = "nodejs";

/** POST /api/aftersales 提交售后报修（契约 §3.2；不修改 orders.status） */
export async function POST(req: Request) {
  return handle(async () => {
    const raw = await req.json().catch(() => null);
    const { result } = await createAftersale(raw);
    return json(ok(result));
  });
}
