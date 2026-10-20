import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  applicationName: "xiu xiu",
  title: {
    default: "xiu xiu · 电脑清灰换硅脂在线预约",
    template: "%s · xiu xiu",
  },
  description:
    "xiu xiu 电脑维修：清灰换硅脂、深度清洁与系统维护在线预约，提交后 30 分钟内电话或微信联系您。",
};

/**
 * viewport-fit=cover 配合 env(safe-area-inset-*) 安全区；
 * 允许用户缩放：不设置 maximumScale / userScalable（UIUX §9.1 / §10）。
 */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN" data-scroll-behavior="smooth">
      <body className="antialiased">{children}</body>
    </html>
  );
}
