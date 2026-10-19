"use client";

import { useId, type InputHTMLAttributes, type ReactNode, type TextareaHTMLAttributes } from "react";
import { clsx } from "clsx";

/* ============================== 短字段（iOS 双列行） ==============================
   标签左 / 输入右对齐 / 无框线，行高 52px（UIUX §6.2）
================================================================================== */

export type FieldRowProps = Omit<InputHTMLAttributes<HTMLInputElement>, "className"> & {
  label: string;
  /** 输入右侧附加内容（如下拉 ▾） */
  trailing?: ReactNode;
  /** Footnote 提示（无错误时显示） */
  hint?: string;
  /** 错误文案；错误行常驻占位，不改变行高（§6.2） */
  error?: string;
  /** 强制错误态（配合 aria-invalid） */
  invalid?: boolean;
};

export function FieldRow({
  label,
  trailing,
  hint,
  error,
  invalid,
  id: idProp,
  ...input
}: FieldRowProps) {
  const generatedId = useId();
  const id = idProp ?? generatedId;
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const hasError = Boolean(error) || invalid === true;

  return (
    <div className="px-4">
      <div className="flex min-h-[3.25rem] items-center gap-3 py-1">
        <label htmlFor={id} className="shrink-0 text-[1.0625rem] text-label">
          {label}
        </label>
        <div className="flex min-w-0 flex-1 items-center justify-end gap-1">
          <input
            id={id}
            className="min-w-0 flex-1 bg-transparent text-right text-[1.0625rem] text-label focus-visible:outline-none"
            aria-invalid={hasError || undefined}
            aria-describedby={error ? errorId : hintId}
            {...input}
          />
          {trailing && <span className="shrink-0 text-label-2">{trailing}</span>}
        </div>
      </div>
      {/* 错误/提示行常驻占位，不抖动布局（§6.2 / §7.5） */}
      <FieldMessage id={errorId ?? hintId} error={error} hint={hint} />
    </div>
  );
}

/* ============================== 长字段（标签在上，满宽） ==============================
   带 --color-fill 底 + 10px 圆角；聚焦：fill 底 + 主色 1.5px 描边（UIUX §6.2）
================================================================================== */

export type FieldBlockProps = {
  label: string;
  hint?: string;
  error?: string;
  invalid?: boolean;
  /** 受控值 */
  value?: string;
  /** 受控变更（简化为 string，便于表单状态管理） */
  onValueChange?: (value: string) => void;
  placeholder?: string;
  maxLength?: number;
  /** 多行时渲染 textarea；默认单行 input */
  rows?: number;
  /** 原生输入提示（如 none / tel / numeric） */
  inputMode?: "none" | "text" | "tel" | "url" | "email" | "numeric" | "decimal" | "search";
  autoComplete?: string;
  className?: string;
};

export function FieldBlock({
  label,
  hint,
  error,
  invalid,
  value,
  onValueChange,
  placeholder,
  maxLength,
  rows,
  inputMode,
  autoComplete,
  className,
}: FieldBlockProps) {
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const hasError = Boolean(error) || invalid === true;
  const multiline = rows !== undefined && rows > 1;

  const controlClass = clsx(
    "w-full min-w-0 rounded-input border bg-fill px-3 py-2.5 text-[1.0625rem] text-label",
    "placeholder:text-label-2 focus-visible:outline-none",
    "transition-[border-color] duration-(--dur-fast)",
    hasError
      ? "border-[1.5px] border-danger"
      : "border-transparent focus:border-[1.5px] focus:border-primary",
  );

  return (
    <div className={clsx("px-4 py-3", className)}>
      <label htmlFor={id} className="mb-2 block text-[0.9375rem] text-label">
        {label}
      </label>
      {multiline ? (
        <textarea
          id={id}
          rows={rows ?? 3}
          value={value}
          placeholder={placeholder}
          maxLength={maxLength}
          autoComplete={autoComplete}
          onChange={onValueChange ? (e) => onValueChange(e.target.value) : undefined}
          aria-invalid={hasError || undefined}
          aria-describedby={error ? errorId : hintId}
          className={clsx(controlClass, "resize-none leading-relaxed")}
        />
      ) : (
        <input
          id={id}
          value={value}
          placeholder={placeholder}
          maxLength={maxLength}
          inputMode={inputMode}
          autoComplete={autoComplete}
          onChange={onValueChange ? (e) => onValueChange(e.target.value) : undefined}
          aria-invalid={hasError || undefined}
          aria-describedby={error ? errorId : hintId}
          className={controlClass}
        />
      )}
      <FieldMessage id={errorId ?? hintId} error={error} hint={hint} className="mt-1.5" />
    </div>
  );
}

/* ============================== 消息行（错误优先，常驻占位） ============================== */

export type FieldMessageProps = {
  id?: string;
  error?: string;
  hint?: string;
  className?: string;
};

/** 错误行常驻占位（min-h 保证无错误时也占据一行高度，布局不抖动） */
export function FieldMessage({ id, error, hint, className }: FieldMessageProps) {
  return (
    <p
      id={id}
      aria-live="polite"
      className={clsx("flex min-h-[1.125rem] items-start gap-1 pt-1 text-footnote", className)}
    >
      {error ? (
        <>
          <WarnIcon className="mt-[2px] size-[0.875rem] shrink-0 text-danger" />
          <span className="text-danger">{error}</span>
        </>
      ) : hint ? (
        <span className="text-label-2">{hint}</span>
      ) : null}
    </p>
  );
}

function WarnIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path d="M12 8.5v5m0 3v.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      <path
        d="M10.3 3.9 2.8 17a2 2 0 0 0 1.7 3h15a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    </svg>
  );
}
