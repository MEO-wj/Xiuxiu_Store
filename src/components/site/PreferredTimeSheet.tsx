/**
 * 期望时间 Bottom Sheet（UIUX §7.6 / PRD A9）：
 * 单选行（尽快/今天/明天/指定时间）52px + 选中 ✓；选「指定时间」展开日期时间；
 * Primary 满宽「确 定」；上滑 350ms（spring）· 下滑/点遮罩关闭。
 * 存储值 ∈ {尽快, 今天, 明天} ∪ yyyy-MM-dd HH:mm（PRD A9）。
 */
"use client";

import { useState } from "react";
import { clsx } from "clsx";

import { Button, Chip } from "@/components/ui";
import { BottomSheet } from "./BottomSheet";
import { CheckIcon, ChevronDownIcon } from "./icons";
import { preferredTimeLabel } from "@/lib/format";

/** 期望时间快捷选项（PRD A9） */
const QUICK_OPTIONS = ["尽快", "今天", "明天"] as const;

/** 明天 yyyy-MM-dd（本地浏览器口径，仅作 date input 初值） */
function tomorrowDate(): string {
  const d = new Date(Date.now() + 24 * 3600 * 1000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export type PreferredTimeSheetProps = {
  open: boolean;
  onClose: () => void;
  /** 存储值：枚举或 yyyy-MM-dd HH:mm */
  value: string;
  onChange: (value: string) => void;
};

export function PreferredTimeSheet({ open, onClose, value, onChange }: PreferredTimeSheetProps) {
  const isCustom = !QUICK_OPTIONS.includes(value as (typeof QUICK_OPTIONS)[number]);
  const initialDate = isCustom ? value.slice(0, 10) : tomorrowDate();
  const initialTime = isCustom ? value.slice(11, 16) : "14:00";
  const [customDate, setCustomDate] = useState(initialDate);
  const [customTime, setCustomTime] = useState(initialTime);

  const quickValue = isCustom ? null : (value as (typeof QUICK_OPTIONS)[number]);

  const confirm = (v: string) => {
    onChange(v);
    onClose();
  };

  const confirmCustom = () => {
    if (/^\d{4}-\d{2}-\d{2}$/.test(customDate) && /^\d{2}:\d{2}$/.test(customTime)) {
      confirm(`${customDate} ${customTime}`);
    } else {
      confirm("尽快");
    }
  };

  return (
    <BottomSheet open={open} onClose={onClose} title="选择期望时间">
      {/* 快捷单选行（§7.6：单选行 52px + 选中 ✓） */}
      <div role="radiogroup" aria-label="期望时间" className="divide-y divide-separator">
        {QUICK_OPTIONS.map((opt) => {
          const selected = quickValue === opt;
          return (
            <button
              key={opt}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => confirm(opt)}
              className="flex w-full items-center justify-between rounded-input py-[0.875rem] text-left active:bg-fill"
            >
              <span className={clsx("text-[1.0625rem]", selected ? "font-semibold text-primary" : "text-label")}>
                {opt}
                {opt === "尽快" && <span className="ml-2 text-footnote text-label-2">默认</span>}
              </span>
              {selected && <CheckIcon className="size-5 text-primary" />}
            </button>
          );
        })}
        {/* 指定时间：展开日期时间（§7.6） */}
        <div className="py-3">
          <button
            type="button"
            role="radio"
            aria-checked={isCustom}
            onClick={() => (isCustom ? confirm("尽快") : confirmCustom())}
            className="flex w-full items-center justify-between rounded-input py-[0.875rem] text-left active:bg-fill"
          >
            <span className={clsx("text-[1.0625rem]", isCustom ? "font-semibold text-primary" : "text-label")}>
              指定时间
            </span>
            {isCustom && <CheckIcon className="size-5 text-primary" />}
          </button>
          <div className="mt-2 flex items-center gap-3 rounded-input bg-fill px-3 py-2.5">
            <label className="flex min-w-0 flex-1 items-center gap-2">
              <span className="shrink-0 text-[0.9375rem] text-label">日期</span>
              <span className="relative min-w-0 flex-1">
                <input
                  type="date"
                  value={customDate}
                  onChange={(e) => setCustomDate(e.target.value)}
                  className="w-full rounded-input border border-transparent bg-surface px-2 py-1.5 text-[0.9375rem] text-label focus:border-[1.5px] focus:border-primary focus-visible:outline-none"
                />
                <ChevronDownIcon className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-label-3" />
              </span>
            </label>
            <label className="flex min-w-0 flex-1 items-center gap-2">
              <span className="shrink-0 text-[0.9375rem] text-label">时间</span>
              <span className="relative min-w-0 flex-1">
                <input
                  type="time"
                  value={customTime}
                  onChange={(e) => setCustomTime(e.target.value)}
                  className="w-full rounded-input border border-transparent bg-surface px-2 py-1.5 text-[0.9375rem] text-label focus:border-[1.5px] focus:border-primary focus-visible:outline-none"
                />
                <ChevronDownIcon className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-label-3" />
              </span>
            </label>
          </div>
          {isCustom && (
            <div className="mt-2">
              <Button variant="primary" block onClick={confirmCustom}>
                确 定
              </Button>
            </div>
          )}
        </div>
      </div>
      {!isCustom && (
        <div className="mt-2 flex flex-wrap items-center gap-2 pb-1">
          {QUICK_OPTIONS.map((opt) => (
            <Chip
              key={opt}
              type="radio"
              name="preferred-time-quick"
              label={preferredTimeLabel(opt)}
              selected={quickValue === opt}
              onSelect={() => confirm(opt)}
            />
          ))}
          <Chip
            type="radio"
            name="preferred-time-quick"
            label="指定时间"
            selected={false}
            onSelect={confirmCustom}
          />
        </div>
      )}
    </BottomSheet>
  );
}
