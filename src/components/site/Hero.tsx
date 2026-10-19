/**
 * Hero 背景四层结构（UIUX §7.2 / PRD §5.2.1 REQ-02/03/04）：
 * L0 动态兜底背景（永远存在，纯 CSS，永不空白）
 * L1 修机视频（HERO_MODE = 'video' 时：canplay 后 800ms 淡入；
 *     弱网/省流/reduced-motion/自动播放被拒/3s 超时 → 移除视频保留兜底，不得闪白）
 * L2 遮罩（存在视频时 rgba(10,18,32,.35)；仅 L0 时 rgba(10,18,32,.18)）
 * L3 内容（店名 + slogan + 两个服务入口卡）
 * Hero 高度 min(72vh, 560px)；横屏 min(60vh, 420px)
 */
"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { clsx } from "clsx";

import { GlowBackdrop } from "./GlowBackdrop";
import { ChevronRightIcon } from "./icons";
import { SHOP_NAME } from "@/lib/constants";

/** 方案开关（PRD §5.2.1：两套方案独立运行、可随时切换；当前无 /hero-bg.mp4 素材） */
export const HERO_MODE: "video" | "motion" = "motion";

/** 主页 slogan（PRD 附录 C 备选一） */
const SLOGAN = "清灰 · 换硅脂 · 系统维护";

export type HeroProps = {
  /** 两个服务入口卡点击：滚动至表单区并预选服务类型（PRD §5.2.3） */
  onPickService: (type: "clean" | "other") => void;
};

export function Hero({ onPickService }: HeroProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  /** 视频就绪（canplay）后淡入；false = 仅兜底背景 */
  const [videoReady, setVideoReady] = useState(false);
  const [videoAlive, setVideoAlive] = useState(HERO_MODE === "video");

  useEffect(() => {
    if (HERO_MODE !== "video") return;
    const v = videoRef.current;
    if (!v) return;

    // 降级判定（PRD §5.2.1 实现参考）：NetworkInformation 未标准化，能力探测式读取
    const conn = (navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string };
    }).connection;
    const slowNet =
      conn?.saveData === true ||
      /(^|-)2g|3g/.test(String(conn?.effectiveType ?? ""));
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (slowNet || reduce) {
      setVideoAlive(false); // 不加载视频，保持 L0 动态背景
      return;
    }

    let removed = false;
    const remove = () => {
      if (removed) return;
      removed = true;
      setVideoAlive(false); // 保持兜底，无过渡（禁止闪白/闪黑，§8.3）
    };

    const timer = window.setTimeout(() => {
      if (v.readyState < 3) remove(); // 3 秒内未就绪即降级
    }, 3000);

    const onCanPlay = () => {
      window.clearTimeout(timer);
      // canplay 后 800ms 淡入覆盖 L0（淡入由 CSS transition 完成）
      setVideoReady(true);
    };

    v.addEventListener("canplay", onCanPlay);
    void v.play().catch(remove); // 自动播放被拒（如 iOS 低电量模式）即降级

    return () => {
      window.clearTimeout(timer);
      v.removeEventListener("canplay", onCanPlay);
    };
  }, []);

  return (
    <section className="relative flex min-h-[min(72vh,560px)] flex-col justify-end overflow-hidden bg-surface-dark landscape:min-h-[min(60vh,420px)] desktop:min-h-[min(56vh,460px)]">
      {/* L0 兜底动态背景：永远存在（z=0） */}
      <GlowBackdrop blobs={3} />

      {/* L1 视频层（z=1）：canplay 后 800ms 淡入；object-fit: cover */}
      {videoAlive && (
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          webkit-playsinline="true"
          x5-playsinline="true"
          preload="auto"
          aria-hidden="true"
          className={clsx(
            "absolute inset-0 z-(--z-video) size-full object-cover transition-opacity duration-(--dur-video-fade)",
            videoReady ? "opacity-100" : "opacity-0",
          )}
        />
      )}

      {/* L2 遮罩层（z=2）：存在视频时 .35；仅 L0 时 .18（UIUX §7.2） */}
      <div
        aria-hidden="true"
        className={clsx(
          "absolute inset-0 z-(--z-mask) transition-[background-color] duration-(--dur-video-fade)",
          videoAlive && videoReady ? "bg-[rgba(10,18,32,.35)]" : "bg-[rgba(10,18,32,.18)]",
        )}
      />

      {/* L3 内容层（z=3）：店名 + slogan + 两个服务入口卡 */}
      <div className="relative z-(--z-content) mx-auto w-full max-w-[75rem] px-4 pb-8 pt-[calc(env(safe-area-inset-top,0px)+5rem)] tablet:px-6 desktop:pb-12">
        <h1 className="text-shadow-on-dark">
          <span className="block text-title-1 font-bold text-text-on-dark">{SHOP_NAME}</span>
          <span className="mt-1 block text-body text-text-on-dark-2">{SLOGAN}</span>
        </h1>

        <div className="mt-6 grid grid-cols-2 gap-3 tablet:max-w-[32rem]">
          {/* 入口卡 1：清灰换硅脂 ¥80 起 */}
          <Link
            href="/order#service"
            onClick={() => onPickService("clean")}
            className="group flex min-h-[4.5rem] flex-col justify-center gap-0.5 rounded-card bg-surface/[.08] px-4 py-3 backdrop-blur-sm transition-transform duration-(--dur-instant) active:scale-[.97]"
          >
            <span className="flex items-center gap-0.5 text-[0.9375rem] font-semibold text-text-on-dark">
              清灰换硅脂
              <ChevronRightIcon className="size-4 opacity-60" />
            </span>
            <span className="text-caption text-text-on-dark-2">¥80 起 · 含 7 天保修</span>
          </Link>
          {/* 入口卡 2：其他问题 · 联系报价 */}
          <Link
            href="/order#service"
            onClick={() => onPickService("other")}
            className="group flex min-h-[4.5rem] flex-col justify-center gap-0.5 rounded-card bg-surface/[.08] px-4 py-3 backdrop-blur-sm transition-transform duration-(--dur-instant) active:scale-[.97]"
          >
            <span className="flex items-center gap-0.5 text-[0.9375rem] font-semibold text-text-on-dark">
              其他问题
              <ChevronRightIcon className="size-4 opacity-60" />
            </span>
            <span className="text-caption text-text-on-dark-2">免费检测 · 联系报价</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
