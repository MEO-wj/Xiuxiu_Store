import { NextResponse } from "next/server";
import { exportQuerySchema } from "@/lib/validation";
import { exportAftersalesCsv, exportFilename, exportOrdersCsv } from "@/server/export";
import { handle, parseOrThrow, requireAdmin, searchParamsToObject } from "../../_lib/http";

export const runtime = "nodejs";

/** GET /api/admin/export?type=orders|aftersales 导出 CSV（契约 §4.10，UTF-8 + BOM） */
export async function GET(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const { type, status, from, to } = parseOrThrow(exportQuerySchema, searchParamsToObject(req));
    const filter = { status, from, to };
    const csv = type === "orders" ? await exportOrdersCsv(filter) : await exportAftersalesCsv(filter);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${exportFilename(type)}"`,
        "Cache-Control": "no-store",
      },
    });
  });
}
