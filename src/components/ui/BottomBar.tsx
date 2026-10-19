import type { ReactNode } from "react";
import { clsx } from "clsx";

export type BottomBarProps = {
  /** 主 CTA 区（通常为 <Button variant="primary" block>） */
  children: ReactNode;
  /** 左侧实时摘要（如 ¥80 起，随选择变化） */
  summary?: ReactNode;
  /** 是否 fixed 定位；≥768px 页面可传 false 改为表单内按钮（UIUX §6.10） */
  fixed?: boolean;
  className?: string;
};

/**
 * 底部固定操作栏（UIUX §6.10）：
 * 毛玻璃 --material-bar + --blur-bar（.glass-bar 含不透明兜底）；
 * 上边 0.5px 分隔线；内边距 12px 16px + env(safe-area-inset-bottom)；层级 --z-footer。
 * 遮挡处理：页面内容区需预留 padding-bottom（globals.css 已提供 .pb-bottom-bar）。
 */
export function BottomBar({ children, summary, fixed = true, className }: BottomBarProps) {
  return (
    <div
      className={clsx(
        "glass-bar z-(--z-footer) border-t-[0.5px] border-separator",
        fixed ? "fixed inset-x-0 bottom-0" : "relative",
        "px-4 pt-3 pb-[calc(var(--space-3)+env(safe-area-inset-bottom,0px))]",
        className,
      )}
    >
      <div className="mx-auto flex w-full max-w-[40rem] items-center gap-4">
        {summary && (
          <div className="shrink-0 tabular-nums text-[1.0625rem] font-semibold text-label">
            {summary}
          </div>
        )}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
