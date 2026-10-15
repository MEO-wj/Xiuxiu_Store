import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { UPLOAD_DIR_ROOT } from "@/server/upload";

export const runtime = "nodejs";

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
};

/**
 * GET /uploads/<yyyy>/<MM>/<file>.jpg 读取上传图片（契约 §3.5 返回相对路径）。
 * 本地开发与生产均可用；生产亦可由 Nginx 直出同目录（开发文档 §7.2）。
 * 单张 ≤5MB，直接整文件返回（避免流式转换在 Node 运行时的不确定性）。
 */
export async function GET(_req: Request, { params }: { params: Promise<{ path: string[] }> }) {
  const { path: segments } = await params;
  const normalizedRoot = path.resolve(UPLOAD_DIR_ROOT);
  const target = path.resolve(normalizedRoot, segments.join("/"));

  // 防路径穿越：解析后必须位于上传根目录内
  if (target !== normalizedRoot && !target.startsWith(normalizedRoot + path.sep)) {
    return new NextResponse("Not Found", { status: 404 });
  }

  let size: number;
  try {
    const info = await stat(target);
    if (!info.isFile()) return new NextResponse("Not Found", { status: 404 });
    size = info.size;
  } catch {
    return new NextResponse("Not Found", { status: 404 });
  }

  try {
    const data = await readFile(target);
    return new NextResponse(new Uint8Array(data), {
      status: 200,
      headers: {
        "Content-Type": MIME[path.extname(target).toLowerCase()] ?? "application/octet-stream",
        "Content-Length": String(size),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (e) {
    console.error("[uploads] 读取失败:", e);
    return new NextResponse("Internal Server Error", { status: 500 });
  }
}
