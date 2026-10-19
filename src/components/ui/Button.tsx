"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";
import { clsx } from "clsx";
import { Spinner } from "./Spinner";

export type ButtonVariant = "primary" | "secondary" | "tinted" | "text" | "icon";

export type ButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "children"> & {
  /** 五型按钮（UIUX §6.1） */
  variant?: ButtonVariant;
  /** 加载态：16px 环形指示器 + 「提交中…」，宽度不塌陷（§6.1 / §7.8） */
  loading?: boolean;
  loadingText?: string;
  /** 满宽（底部操作栏内 CTA） */
  block?: boolean;
  children?: ReactNode;
};

const BASE =
  "relative inline-flex select-none items-center justify-center font-semibold " +
  "transition-[transform,background-color,border-color,color] duration-(--dur-instant) ease-gentle " +
  "focus-visible:[outline:2px_solid_var(--color-primary)] focus-visible:[outline-offset:2px] " +
  "active:scale-[.97] disabled:cursor-not-allowed disabled:opacity-40 disabled:active:scale-100";

const VARIANTS: Record<ButtonVariant, string> = {
  /* 蓝底白字，高 50px，圆角 12px，Headline 600，主按钮阴影 */
  primary:
    "h-[3.125rem] rounded-card bg-primary px-6 text-headline text-white shadow-btn hover:bg-primary-active active:bg-primary-active",
  /* 白底 + 1px 主色描边 + 主色文字，高 44px */
  secondary:
    "h-11 rounded-card border border-primary bg-surface px-5 text-[1.0625rem] text-primary hover:bg-primary-soft active:bg-primary-soft",
  /* primary-soft 底 + 主色文字，高 40px；伪元素补足 ≥44px 热区（PRD §5.5） */
  tinted:
    "h-10 rounded-card bg-primary-soft px-4 text-[0.9375rem] text-primary hover:bg-primary/20 active:bg-primary/20 " +
    "after:absolute after:-inset-y-1 after:inset-x-0 after:content-['']",
  /* 无底色，主色文字 */
  text: "h-11 rounded-card px-3 text-[1.0625rem] text-primary hover:bg-primary-soft active:bg-primary-soft",
  /* 44×44px 热区，图标 24px（§6.1 / §11.2） */
  icon: "size-11 rounded-full text-label hover:bg-fill active:bg-fill [&_svg]:size-6",
};

export function Button({
  variant = "primary",
  loading = false,
  loadingText = "提交中…",
  block = false,
  disabled = false,
  type = "button",
  className,
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={clsx(BASE, VARIANTS[variant], block && "w-full", className)}
      {...rest}
    >
      {/* 原文案保持占位（invisible），避免加载态宽度塌陷 */}
      <span className={clsx("inline-flex items-center gap-2", loading && "invisible")}>
        {children}
      </span>
      {loading && (
        <span className="absolute inset-0 flex items-center justify-center gap-2" aria-hidden="true">
          <Spinner size={16} />
          {variant !== "icon" && <span>{loadingText}</span>}
        </span>
      )}
    </button>
  );
}
