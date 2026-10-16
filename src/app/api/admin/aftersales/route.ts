import { ok } from "@/lib/response";
import { aftersaleListQuerySchema } from "@/lib/validation";
import { listAftersales } from "@/server/aftersale-service";
import { handle, json, parseOrThrow, requireAdmin, searchParamsToObject } from "../../_lib/http";

export const runtime = "nodejs";

/** GET /api/admin/aftersales 售后列表（契约 §4.7） */
export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const query = parseOrThrow(aftersaleListQuerySchema, searchParamsToObject(req));
    const data = await listAftersales(query);
    return json(ok(data));
  });
}
