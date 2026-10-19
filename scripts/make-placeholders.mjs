/**
 * 生成占位素材（幂等，可重复执行）：
 *   public/wechat-qr.png          400×400  官方微信二维码占位
 *   public/sample-model-label.jpg 600×400  型号标签示例图占位
 * 上线前用同名的真实图片覆盖即可，无需改代码（PRD §12.2 素材替换）。
 */
import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import path from "node:path";

const OUT = path.join(process.cwd(), "public");
await mkdir(OUT, { recursive: true });

const plate = (w, h, label) => Buffer.from(`<svg width="${w}" height="${h}">
  <rect x="4" y="4" width="${w - 8}" height="${h - 8}" fill="#F2F4F8" stroke="#9AA3B2"
        stroke-width="2" stroke-dasharray="10 8" rx="12"/>
  <text x="50%" y="48%" text-anchor="middle" font-family="PingFang SC, Microsoft YaHei, sans-serif"
        font-size="${Math.round(w / 18)}" fill="#6B7280">${label}</text>
  <text x="50%" y="60%" text-anchor="middle" font-family="PingFang SC, Microsoft YaHei, sans-serif"
        font-size="${Math.round(w / 28)}" fill="#9AA3B2">上线前请替换为真实图片</text>
</svg>`);

await sharp(plate(400, 400, "示例二维码待替换")).png().toFile(path.join(OUT, "wechat-qr.png"));
await sharp(plate(600, 400, "示例图待替换")).jpeg({ quality: 80 }).toFile(path.join(OUT, "sample-model-label.jpg"));

console.log("[placeholders] 已生成 public/wechat-qr.png 与 public/sample-model-label.jpg");
