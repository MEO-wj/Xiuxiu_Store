import { ok } from "@/lib/response";
import { UploadError, checkUploadRateLimit, processUpload } from "@/server/upload";
import { clientIp, handle, json } from "../_lib/http";

export const runtime = "nodejs";

/** POST /api/upload 图片上传（契约 §3.5；服务端只校验类型与单张大小，不校验总张数） */
export async function POST(req: Request) {
  return handle(async () => {
    checkUploadRateLimit(clientIp(req));
    const form = await req.formData();
    const file = form.get("file");
    if (!(file instanceof Blob)) throw new UploadError(40005, "请选择要上传的图片");
    const buffer = Buffer.from(await file.arrayBuffer());
    const data = await processUpload(buffer, file.type);
    return json(ok(data));
  });
}
