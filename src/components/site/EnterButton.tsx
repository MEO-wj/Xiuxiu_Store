/** 首屏「进 入」按钮：客户端组件，点击后路由跳转 /order（REQ-01-3）。 */
"use client";

import { useRouter } from "next/navigation";

import { Button, type ButtonProps } from "@/components/ui";

export function EnterButton({ children = "进 入", ...rest }: ButtonProps) {
  const router = useRouter();
  return (
    <Button variant="primary" onClick={() => router.push("/order")} {...rest}>
      {children}
    </Button>
  );
}
