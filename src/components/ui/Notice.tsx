import type { ReactNode } from "react";
import { clsx } from "clsx";

export type NoticeVariant = "info" | "warning" | "success" | "error";

export type NoticeProps = {
  variant: NoticeVariant;
  children: ReactNode;
  className?: string;
};

type VariantStyle = {
  wrap: string;
  icon: ReactNode;
};

const VARIANTS: Record<NoticeVariant, VariantStyle> = {
  /* 主色 8% 底 + 左侧 3px 主色边（UIUX §6.8） */
  info: {
    wrap: "bg-primary/[.08] border-l-[3px] border-l-primary text-label",
    icon: <InfoIcon className="text-primary" />,
  },
  /* warning 10% 底 + 3px 橙边 + ⚠ */
  warning: {
    wrap: "bg-warning/[.10] border-l-[3px] border-l-warning text-label",
    icon: <WarnIcon className="text-warning" />,
  },
  /* success 10% 底 + ✓ */
  success: {
    wrap: "bg-success/[.10] border-l-[3px] border-l-success text-label",
    icon: <CheckIcon className="text-success" />,
  },
  /* danger 10% 底（错误：图标 + 颜色 + 文案三通道，§3.1） */
  error: {
    wrap: "bg-danger/[.10] border-l-[3px] border-l-danger text-label",
    icon: <WarnIcon className="text-danger" />,
  },
};

/**
 * Inline Notice 提示条（UIUX §6.8）：圆角 12px，正文 15/20（Subheadline），
 * 图标 + 颜色双通道表意，禁止仅靠颜色。
 */
export function Notice({ variant, children, className }: NoticeProps) {
  const v = VARIANTS[variant];
  return (
    <div
      role={variant === "error" ? "alert" : "note"}
      className={clsx(
        "flex items-start gap-2.5 rounded-card px-3.5 py-2.5",
        v.wrap,
        className,
      )}
    >
      <span className="mt-[3px] shrink-0">{v.icon}</span>
      <div className="min-w-0 flex-1 text-[0.9375rem] leading-5">{children}</div>
    </div>
  );
}

function iconBase(className?: string) {
  return clsx("size-[1.125rem]", className);
}

function InfoIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={iconBase(className)}>
      <circle cx="12" cy="12" r="9.25" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 10.5v6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="7.5" r="1.1" fill="currentColor" />
    </svg>
  );
}

function WarnIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={iconBase(className)}>
      <path
        d="M10.3 3.9 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
      <path d="M12 9v4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <circle cx="12" cy="17" r="1.1" fill="currentColor" />
    </svg>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={iconBase(className)}>
      <circle cx="12" cy="12" r="9.25" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="m8 12.5 2.7 2.7L16.5 9"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
