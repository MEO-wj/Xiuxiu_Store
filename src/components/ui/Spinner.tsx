import { clsx } from "clsx";

export type SpinnerProps = {
  /** 直径 px；按钮内 16，页面级 20（UIUX §6.11） */
  size?: number;
  className?: string;
  /** 无障碍标签 */
  label?: string;
};

/** 环形加载指示器：主色、800ms/圈（UIUX §6.11），颜色跟随 currentColor */
export function Spinner({ size = 20, className, label = "加载中" }: SpinnerProps) {
  return (
    <svg
      role="status"
      aria-label={label}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      className={clsx("animate-spinner text-current", className)}
    >
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}
