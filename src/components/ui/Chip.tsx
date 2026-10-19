"use client";

import { useId } from "react";
import { clsx } from "clsx";

export type ChipProps = {
  label: string;
  selected: boolean;
  onSelect: () => void;
  /** 单选（radio）/ 多选（checkbox）组语义，默认多选 */
  type?: "radio" | "checkbox";
  /** 组名，单选组必填 */
  name?: string;
  disabled?: boolean;
  className?: string;
};

/**
 * Chip 标签（UIUX §6.5）
 * 视觉高 36px 胶囊；选中：primary-soft 底 + 主色文字 + 1px 主色描边 + 对勾；
 * 未选中：白底 + separator 描边。伪元素补足 ≥44px 热区（PRD §5.5）。
 */
export function Chip({
  label,
  selected,
  onSelect,
  type = "checkbox",
  name,
  disabled,
  className,
}: ChipProps) {
  const fallbackName = useId();
  const inputName = name ?? fallbackName;

  return (
    <label
      className={clsx(
        "relative inline-flex cursor-pointer items-center",
        disabled && "cursor-not-allowed",
        !disabled && "after:absolute after:-inset-x-1 after:-inset-y-[4px] after:content-['']",
        className,
      )}
    >
      <input
        type={type}
        name={inputName}
        checked={selected}
        disabled={disabled}
        onChange={onSelect}
        className="sr-only peer"
      />
      <span
        className={clsx(
          "inline-flex min-h-9 items-center rounded-pill border px-4 py-1.5",
          "text-[0.9375rem] font-medium transition-[background-color,border-color,color,transform] duration-(--dur-fast) ease-gentle",
          "peer-focus-visible:[outline:2px_solid_var(--color-primary)] peer-focus-visible:[outline-offset:2px]",
          "peer-active:scale-[.97]",
          selected
            ? "border-primary bg-primary-soft text-primary"
            : "border-separator bg-surface text-label hover:bg-fill",
          disabled && "opacity-40",
        )}
      >
        {selected && <CheckIcon className="mr-1.5 size-4 shrink-0" />}
        {label}
      </span>
    </label>
  );
}

function CheckIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="m5 12.5 4.5 4.5L19 7.5"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
