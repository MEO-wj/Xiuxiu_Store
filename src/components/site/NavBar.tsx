/**
 * 吸顶导航栏（UIUX §5.2 Large Title 收缩 / §7.2）：
 * 滚动 0→60px 区间内：大标题 30px→17px 左移入导航栏，导航栏由透明渐显为毛玻璃。
 * 毛玻璃材质 .glass-bar（不透明兜底见 globals.css）；层级 --z-nav。
 */
"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { clsx } from "clsx";

import { ChevronLeftIcon } from "./icons";

export type NavBarProps = {
  /** 导航栏小标题（收缩后展示，17px/600） */
  title: string;
  /** 返回目标；默认返回主页（UIUX §5.2：成功页/售后页均返回主页） */
  backHref?: string | null;
  /** 返回按钮 aria-label */
  backLabel?: string;
  /** 右侧附加内容 */
  right?: ReactNode;
  className?: string;
};

/** 滚动阈值映射：0→60px（UIUX §5.2） */
const SCROLL_RANGE = 60;

export function NavBar({ title, backHref = "/", backLabel = "返回", right, className }: NavBarProps) {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    let raf = 0;
    const update = () => {
      raf = 0;
      setProgress(Math.min(1, Math.max(0, window.scrollY / SCROLL_RANGE)));
    };
    const onScroll = () => {
      if (raf === 0) raf = window.requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      if (raf !== 0) window.cancelAnimationFrame(raf);
    };
  }, []);

  const shown = progress > 0.02;

  return (
    <header
      className={clsx(
        "fixed inset-x-0 top-0 z-(--z-nav) transition-colors duration-(--dur-base)",
        shown ? "glass-bar border-b-[0.5px] border-separator" : "border-b-[0.5px] border-transparent",
        className,
      )}
    >
      <div className="mx-auto flex h-[3.25rem] w-full max-w-[75rem] items-center gap-1 px-2 pt-[env(safe-area-inset-top,0px)] tablet:px-4">
        {backHref && (
          <Link
            href={backHref}
            aria-label={backLabel}
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-label transition-colors duration-(--dur-instant) hover:bg-fill active:bg-fill"
          >
            <ChevronLeftIcon />
          </Link>
        )}
        {/* 小标题：随滚动渐显（透明度 = progress），未滚动时完全隐藏 */}
        <span
          className={clsx(
            "min-w-0 truncate text-headline font-semibold text-label transition-opacity duration-(--dur-base)",
            shown ? "opacity-100" : "opacity-0 tablet:opacity-100",
          )}
        >
          {title}
        </span>
        <div className="min-w-0 flex-1" />
        {right && <div className="flex shrink-0 items-center pr-2">{right}</div>}
      </div>
    </header>
  );
}
