import { ok } from "@/lib/response";
import { aftersaleUpdateSchema } from "@/lib/validation";
import { getAftersaleDetail, updateAftersale } from "@/server/aftersale-service";
import { handle, json, parseOrThrow, requireAdmin } from "../../../_lib/http";

export const runtime = "nodejs";

/** GET /api/admin/aftersales/{id} 售后详情（契约 §4.8） */
export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await params;
    const data = await getAftersaleDetail(id);
    return json(ok(data));
  });
}

/** PATCH /api/admin/aftersales/{id} 处理售后（契约 §4.9，非法流转 → 40006） */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await params;
    const raw = await req.json().catch(() => null);
    const patch = parseOrThrow(aftersaleUpdateSchema, raw);
    const data = await updateAftersale(id, patch);
    return json(ok(data));
  });
}
