"use client";

import { useEffect, type ReactNode } from "react";
import { clsx } from "clsx";

export type ToastProps = {
  /** 是否展示（受控） */
  open: boolean;
  message: ReactNode;
  /** 停留时长 ms，默认 2500（UIUX §6.11）；≤0 不自动关闭 */
  duration?: number;
  /** 自动关闭回调 */
  onClose?: () => void;
  className?: string;
};

/**
 * Toast 轻提示（UIUX §6.11 / §8.3）：
 * 顶部居中胶囊，rgba(10,18,32,.9)（--color-surface-dark 90%）底 + 白字，Footnote 级；
 * 上移淡入 200ms → 停留 2.5s → 淡出 200ms；层级 --z-toast。
 */
export function Toast({ open, message, duration = 2500, onClose, className }: ToastProps) {
  useEffect(() => {
    if (!open || duration <= 0 || !onClose) return;
    const timer = window.setTimeout(onClose, duration);
    return () => window.clearTimeout(timer);
  }, [open, duration, onClose]);

  return (
    <div
      role="status"
      aria-live="polite"
      className={clsx(
        "pointer-events-none fixed inset-x-0 z-(--z-toast) flex justify-center",
        "top-[calc(env(safe-area-inset-top,0px)+var(--space-4))]",
        "transition-[transform,opacity] duration-(--dur-fast) ease-gentle",
        open ? "translate-y-0 opacity-100" : "-translate-y-2 opacity-0",
        className,
      )}
    >
      <div className="max-w-[86.666667%] rounded-pill bg-[color-mix(in_srgb,var(--color-surface-dark)_90%,transparent)] px-4 py-2 text-footnote text-white shadow-sheet">
        {message}
      </div>
    </div>
  );
}
