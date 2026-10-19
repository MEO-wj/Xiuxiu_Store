"use client";

import { useId, type ReactNode } from "react";
import { clsx } from "clsx";

export type SegmentedOption<T extends string = string> = {
  value: T;
  label: ReactNode;
  /** 禁用该项 */
  disabled?: boolean;
};

export type SegmentedProps<T extends string = string> = {
  options: ReadonlyArray<SegmentedOption<T>>;
  value: T;
  onChange: (value: T) => void;
  /** 无障碍名称（radiogroup） */
  label: string;
  className?: string;
  name?: string;
};

/**
 * iOS Segmented Control（UIUX §6.4）
 * 轨道 --color-fill / 圆角 10px，共 36px 高；选中项白底 + 轻阴影 + 圆角 8px（32px 高）；
 * 切换 200ms（--ease-spring）。选项视觉 32px，通过伪元素补足 ≥44px 热区（PRD §5.5）。
 */
export function Segmented<T extends string = string>({
  options,
  value,
  onChange,
  label,
  className,
  name,
}: SegmentedProps<T>) {
  const id = useId();
  const groupName = name ?? id;

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className={clsx("flex w-full gap-0 rounded-input bg-fill p-1", className)}
    >
      {options.map((opt) => {
        const selected = opt.value === value;
        return (
          <label
            key={opt.value}
            className={clsx(
              // 32px 视觉高度；伪元素上下各补 6px → 44px 热区
              "relative flex h-8 flex-1 cursor-pointer items-center justify-center",
              "rounded-[calc(var(--radius-input)-2px)]",
              "transition-[background-color,box-shadow] duration-(--dur-fast) ease-spring",
              "has-[:focus-visible]:[outline:2px_solid_var(--color-primary)] has-[:focus-visible]:[outline-offset:2px]",
              selected
                ? "bg-surface shadow-[0_1px_4px_rgba(10,18,32,.10)]"
                : "hover:bg-surface/40",
              opt.disabled && "cursor-not-allowed opacity-40",
              !opt.disabled && "after:absolute after:-inset-y-[6px] after:inset-x-0 after:content-['']",
            )}
          >
            <input
              type="radio"
              name={groupName}
              value={opt.value}
              checked={selected}
              disabled={opt.disabled}
              onChange={() => onChange(opt.value)}
              className="sr-only"
            />
            <span
              className={clsx(
                "text-[0.9375rem] leading-5",
                selected ? "font-semibold text-label" : "font-medium text-label-2",
              )}
            >
              {opt.label}
            </span>
          </label>
        );
      })}
    </div>
  );
}
