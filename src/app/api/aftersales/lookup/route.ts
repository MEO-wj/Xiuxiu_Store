import { ok } from "@/lib/response";
import { lookupQuerySchema } from "@/lib/validation";
import { lookupOrder } from "@/server/aftersale-service";
import { handle, json, parseOrThrow, searchParamsToObject } from "../../_lib/http";

export const runtime = "nodejs";

/** GET /api/aftersales/lookup?phone= 按手机号匹配最近一单（契约 §3.3，脱敏） */
export async function GET(req: Request) {
  return handle(async () => {
    const { phone } = parseOrThrow(lookupQuerySchema, searchParamsToObject(req));
    const data = await lookupOrder(phone);
    return json(ok(data));
  });
}
