/**
 * 图片上传处理：sharp 防御性压缩（开发文档 §5.4、API 契约 §1.8/§3.5）。
 *
 * 处理链：类型白名单 → 单张 ≤5MB → rotate()（EXIF 旋转校正）→ resize 长边 ≤1920
 *        → jpeg({quality:80}) → 随机 16 位文件名 → 落盘 storage/uploads/yyyy/MM/
 * 返回：/uploads/yyyy/MM/<random>.jpg + 宽高与字节数。
 *
 * HEIC 解码不可用 / 处理失败 → UploadError(50000 + 指定文案)；
 * 类型/大小不合法 / 同 IP 限流 → UploadError(40005)。
 */
import { randomBytes } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

import sharp from "sharp";

import { ErrorCode, MAX_UPLOAD_BYTES, UPLOAD_RATE_LIMIT_DEFAULT } from "@/lib/constants";
import { ServiceError } from "@/lib/response";
import type { UploadResult } from "@/lib/types";
import { UPLOAD_MIME_TYPES } from "@/lib/validation";

export const UPLOAD_DIR_ROOT = path.join(process.cwd(), "storage", "uploads");

/** 允许的 MIME（契约 §1.8） */
export const ALLOWED_MIME: readonly string[] = UPLOAD_MIME_TYPES;

/** HEIC 不可用时给用户的可读文案（开发文档 §5.4 / API 契约 §3.5，一字不差） */
export const HEIC_FALLBACK_MESSAGE = "请改用 JPG/PNG，或在微信中直接发送照片给店主";

/** 上传错误（路由层捕获后转统一响应） */
export class UploadError extends ServiceError {}

/** 上传大小/类型不合法 → 40005（契约 §1.4 文案） */
export function invalidUpload(message?: string): UploadError {
  return new UploadError(ErrorCode.UPLOAD_INVALID, message);
}

// 同 IP 限流（内存态，契约 §1.6：阈值 UPLOAD_RATE_LIMIT_PER_HOUR，默认 30）
type RateBucket = { count: number; resetAt: number };
const globalForUpload = globalThis as unknown as { __xiuxiuUploadRate?: Map<string, RateBucket> };
const uploadRate: Map<string, RateBucket> = globalForUpload.__xiuxiuUploadRate ?? new Map();
globalForUpload.__xiuxiuUploadRate = uploadRate;

function uploadRateLimitPerHour(): number {
  const raw = Number.parseInt(process.env.UPLOAD_RATE_LIMIT_PER_HOUR ?? "", 10);
  return Number.isFinite(raw) && raw > 0 ? raw : UPLOAD_RATE_LIMIT_DEFAULT;
}

/** 同 IP 每小时限流检查（超出 → 40005） */
export function checkUploadRateLimit(ip: string, now: Date = new Date()): void {
  const limit = uploadRateLimitPerHour();
  const bucket = uploadRate.get(ip);
  if (!bucket || bucket.resetAt <= now.getTime()) {
    uploadRate.set(ip, { count: 1, resetAt: now.getTime() + 3600_000 });
    return;
  }
  if (bucket.count >= limit) {
    throw invalidUpload("上传过于频繁，请稍后再试");
  }
  bucket.count += 1;
}

// ─── 主处理函数 ───────────────────────────────────────────────────────────────

/**
 * 处理一张上传图片。
 * @param buffer 原始字节
 * @param contentType 客户端声明的 MIME
 * @param now 用于目录分桶 yyyy/MM（Asia/Shanghai）
 */
export async function processUpload(
  buffer: Buffer,
  contentType: string,
  now: Date = new Date(),
): Promise<UploadResult> {
  // 1. 类型白名单（含 heic）
  if (!ALLOWED_MIME.includes(contentType)) {
    throw invalidUpload("不支持的图片格式（仅支持 JPG / PNG / WebP / HEIC）");
  }
  // 2. 单张大小（契约 §1.8：服务端只校验类型与单张大小，不校验总张数）
  if (buffer.byteLength <= 0) {
    throw invalidUpload("图片内容为空");
  }
  if (buffer.byteLength > MAX_UPLOAD_BYTES) {
    throw invalidUpload("单张图片不能超过 5MB");
  }

  // 3. sharp 处理链（HEIC 解码不可用会在此抛错）
  let outBuffer: Buffer;
  try {
    outBuffer = await sharp(buffer, { failOn: "error" })
      .rotate() // EXIF 旋转校正
      .resize({ width: 1920, height: 1920, fit: "inside", withoutEnlargement: true }) // 长边 ≤1920
      .jpeg({ quality: 80 }) // 统一输出 JPG
      .toBuffer();
  } catch (e) {
    throw processError(e, contentType);
  }

  // 宽高（响应字段）
  let width = 0;
  let height = 0;
  try {
    const meta = await sharp(outBuffer).metadata();
    width = meta.width ?? 0;
    height = meta.height ?? 0;
  } catch {
    // 元数据读取失败不影响落盘
  }

  // 4. 随机 16 位文件名（禁用原始文件名，防路径穿越与信息泄露）+ yyyy/MM 目录
  const name = randomBytes(8).toString("hex"); // 16 hex chars
  const { monthDir, urlPath } = shanghaiMonthDir(now);
  const absDir = path.join(UPLOAD_DIR_ROOT, monthDir);
  await mkdir(absDir, { recursive: true });
  await writeFile(path.join(absDir, `${name}.jpg`), outBuffer);

  return { url: `${urlPath}/${name}.jpg`, size: outBuffer.byteLength, width, height };
}

/** sharp 解码失败 → 50000 + HEIC 指定文案（契约 §3.5） */
function processError(_e: unknown, _contentType: string): UploadError {
  return new UploadError(ErrorCode.INTERNAL, HEIC_FALLBACK_MESSAGE);
}

/** yyyy/MM 目录（Asia/Shanghai）与对应 URL 前缀 /uploads/yyyy/MM */
function shanghaiMonthDir(now: Date): { monthDir: string; urlPath: string } {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
  });
  const parts: Record<string, string> = {};
  for (const p of fmt.formatToParts(now)) parts[p.type] = p.value;
  const monthDir = `${parts["year"]}/${parts["month"]}`;
  return { monthDir, urlPath: `/uploads/${monthDir}` };
}
