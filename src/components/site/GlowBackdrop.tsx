/**
 * 纯 CSS 动态兜底背景（UIUX §8.2 / REQ-04）：深空蓝底 + 2–3 团光晕缓慢漂移。
 *
 * - 底色 --color-surface-dark（#0A1220，非纯黑）
 * - 光晕 radial-gradient：A(--color-glow-a) / B(--color-glow-b)，单团直径 ≥120vw
 * - 透明度 20%–35%；translate3d ≤6% 视口 + scale 1.00→1.08；24–30s/循环，多团错开延迟（0 / -8s / -16s）
 * - 仅驱动 transform / opacity（GPU 合成，不触发重排）
 * - 零文件下载，SSR 即有呈现，永不空白
 * - prefers-reduced-motion：globals.css 全局降级为静态（动画时长 0.01ms），保留色彩层次
 * - 层级 --z-bg = 0，永远存在不可移除
 */
import { clsx } from "clsx";

export type GlowBackdropProps = {
  className?: string;
  /** 光晕数量：2 或 3 团（UIUX §8.2） */
  blobs?: 2 | 3;
};

export function GlowBackdrop({ className, blobs = 3 }: GlowBackdropProps) {
  return (
    <div
      aria-hidden="true"
      className={clsx(
        "pointer-events-none absolute inset-0 z-(--z-bg) overflow-hidden bg-surface-dark",
        className,
      )}
    >
      <div
        className="xx-glow xx-anim-glow-a size-[130vmax] opacity-25"
        style={{
          top: "-40vmax",
          left: "-35vmax",
          background: "radial-gradient(circle, var(--color-glow-a) 0%, transparent 62%)",
        }}
      />
      <div
        className="xx-glow xx-anim-glow-b size-[120vmax] opacity-30"
        style={{
          top: "8vmax",
          right: "-45vmax",
          background: "radial-gradient(circle, var(--color-glow-b) 0%, transparent 60%)",
        }}
      />
      {blobs === 3 && (
        <div
          className="xx-glow xx-anim-glow-c size-[125vmax] opacity-20"
          style={{
            bottom: "-55vmax",
            left: "18vmax",
            background: "radial-gradient(circle, var(--color-glow-a) 0%, transparent 58%)",
        }}
      />
      )}
    </div>
  );
}
