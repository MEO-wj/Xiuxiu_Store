import { clsx } from "clsx";

export type SkeletonProps = {
  /** text：一行文本条；rect：矩形块（卡片/图）；circle：头像/图标位 */
  variant?: "text" | "rect" | "circle";
  /** text 变体宽度档位 */
  width?: "full" | "2/3" | "1/2";
  className?: string;
};

const WIDTHS = { full: "w-full", "2/3": "w-2/3", "1/2": "w-1/2" } as const;

/**
 * 骨架屏（UIUX §6.11）：--color-fill 底 + 1.2s 渐变扫光；
 * prefers-reduced-motion 时由全局降级规则冻结为静态灰块。
 */
export function Skeleton({ variant = "text", width = "full", className }: SkeletonProps) {
  return (
    <div
      aria-hidden="true"
      className={clsx(
        "relative overflow-hidden bg-fill",
        variant === "circle" ? "size-12 rounded-full" : "h-4 rounded-pill",
        variant === "text" && WIDTHS[width],
        className,
      )}
    >
      <div
        className={clsx(
          "absolute inset-0 animate-sweep",
          "bg-[linear-gradient(90deg,transparent,color-mix(in_srgb,var(--color-surface)_50%,transparent),transparent)]",
        )}
      />
    </div>
  );
}

/** 多行文本骨架组合（订单匹配查询、后台列表加载，§7.10 / §7.15） */
export function SkeletonText({ lines = 3 }: { lines?: number }) {
  return (
    <div className="flex flex-col gap-2.5" aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} width={i === lines - 1 ? "2/3" : "full"} />
      ))}
    </div>
  );
}
