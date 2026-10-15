import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // sharp 用于服务端图片压缩 / HEIC 转 JPG
  serverExternalPackages: ["sharp"],
  // /uploads/* 由 src/app/uploads/[...path]/route.ts 从 storage/uploads 读取
  // （rewrite 无法指向非 public 目录，故改用 Route Handler；生产亦可由 Nginx 直出）
};

export default nextConfig;
