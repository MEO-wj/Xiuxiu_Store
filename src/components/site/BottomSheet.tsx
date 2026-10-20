/**
 * Bottom Sheet 半屏抽屉（UIUX §5.3 / §7.6）：
 * - 从底部上滑 350ms（--ease-spring）；顶部 22px 圆角（--radius-sheet）+ 抓手条 grabber
 * - 背景遮罩 rgba(10,18,32,.4) 淡入；点击遮罩关闭；层级 --z-sheet = 60
 * - role="dialog" + 焦点锁定（Tab 循环）+ Esc 关闭
 * - prefers-reduced-motion：globals.css 全局降级为直接切换
 */
"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { clsx } from "clsx";

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])';

export type BottomSheetProps = {
  open: boolean;
  onClose: () => void;
  /** Sheet 标题（Title3，§7.6） */
  title: string;
  children: ReactNode;
  className?: string;
};

export function BottomSheet({ open, onClose, title, children, className }: BottomSheetProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);

  useEffect(() => {
    if (!open) return;
    const panel = panelRef.current;
    const trigger = document.activeElement as HTMLElement | null;
    panel?.querySelector<HTMLElement>(FOCUSABLE)?.focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        closeRef.current();
        return;
      }
      if (e.key !== "Tab" || !panel) return;
      const focusables = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null,
      );
      if (focusables.length === 0) return;
      const first = focusables[0]!;
      const last = focusables[focusables.length - 1]!;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden"; // 打开期间锁定背景滚动
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKeyDown);
      trigger?.focus({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-(--z-sheet)" role="presentation">
      {/* 遮罩：rgba(10,18,32,.4) 淡入（§5.3），点击关闭 */}
      <div
        className="xx-fade-in absolute inset-0 bg-[rgba(10,18,32,.4)]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={clsx(
          "sheet-panel xx-sheet-in absolute inset-x-0 bottom-0 mx-auto w-full max-w-[40rem] rounded-t-[var(--radius-sheet)] bg-surface shadow-sheet",
          "pb-[calc(env(safe-area-inset-bottom,0px)+var(--space-4))]",
          className,
        )}
      >
        {/* 抓手条 grabber */}
        <div className="flex justify-center pt-2.5" aria-hidden="true">
          <span className="h-[5px] w-9 rounded-pill bg-separator" />
        </div>
        <div className="sheet-header"><h2 className="text-title-3 text-label">{title}</h2><button type="button" onClick={onClose} aria-label="关闭时间选择">×</button></div>
        <div className="px-4 pt-2">{children}</div>
      </div>
    </div>
  );
}
