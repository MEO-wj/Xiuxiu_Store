import type { ReactNode } from "react";
import { clsx } from "clsx";

export type QrCardProps = {
  /** 二维码位图地址；默认占位图（§11.1） */
  src?: string;
  alt?: string;
  /**
   * 二维码显示边长 px，直接设置 width/height（不做 scale，§6.7 硬约束 3）。
   * 参考取值：表单内 120–140 / 选中放大 180–200 / 底部信息区 96 / 成功页 240。
   */
  size?: number;
  /** 高亮变体：主色 1.5px 描边 + 淡蓝底 + 3s 呼吸光晕（§6.7 / §8.3；reduced-motion 时静态） */
  highlighted?: boolean;
  /** 二维码旁标题（如「扫码加 xiu xiu 官方微信」） */
  title?: string;
  /** 标题下说明（如「微信里聊也行」） */
  description?: string;
  /** 长按识别教育文案；null 可隐藏（§6.7 硬约束 5：必须提示） */
  hint?: string | null;
  className?: string;
};

/**
 * 官方微信二维码模块（UIUX §6.7 微信长按识别硬性要求）：
 * 1. 必须 `<img>` 加载位图，不用 CSS background-image；
 * 2. 二维码四周 ≥8px（--space-2）纯白留白：高亮描边/光晕只作用于外层容器，
 *    内层白色 plate（--color-surface）保证二维码直接贴纯白底；
 * 3. 不用 transform: scale()，尺寸直接走 width/height；
 * 4. 二维码本体无 filter / opacity<1 / mix-blend-mode / 遮罩覆盖。
 */
export function QrCard({
  src = "/wechat-qr.png",
  alt = "xiu xiu 官方微信二维码",
  size = 140,
  highlighted = false,
  title,
  description,
  hint = "长按识别二维码",
  className,
}: QrCardProps) {
  const hasSide = Boolean(title || description);

  const qr = (
    <span
      className={clsx(
        "inline-block shrink-0 rounded-[var(--radius-thumb)]",
        highlighted &&
          "animate-qr-glow border-[1.5px] border-primary bg-primary-soft p-[6px] ring-[6px] ring-primary-soft",
      )}
    >
      {/* 内层纯白 plate：四周 8px 白色留白，任何状态下不被覆盖/着色 */}
      <span className="inline-block rounded-[calc(var(--radius-thumb)-2px)] bg-surface p-2">
        {/* 硬约束：img 直出位图；不加任何滤镜/覆盖/缩放 */}
        <img
          src={src}
          alt={alt}
          width={size}
          height={size}
          draggable={false}
          className="block h-auto max-w-none select-none"
          style={{ width: size, height: size }}
        />
      </span>
    </span>
  );

  const caption = (title || description || hint !== null) && (
    <span className={clsx("flex flex-col gap-1", !hasSide && "items-center text-center")}>
      {title && <span className="text-[0.9375rem] font-semibold text-label">{title}</span>}
      {description && <span className="text-[0.8125rem] text-label-2">{description}</span>}
      {hint !== null && (
        <span className="inline-flex items-center gap-1 text-caption text-label-2">
          <PressIcon className="size-[0.875rem]" />
          {hint}
        </span>
      )}
    </span>
  );

  return (
    <div
      className={clsx(
        hasSide ? "flex items-center gap-4" : "inline-flex flex-col items-center gap-2",
        className,
      )}
    >
      {qr}
      {caption}
    </div>
  );
}

function PressIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className={className}>
      <path
        d="M9 11.5V5a1.5 1.5 0 0 1 3 0v5m0-2.5a1.5 1.5 0 0 1 3 0V10m0-1a1.5 1.5 0 0 1 3 0v4.5c0 3.9-2.6 6.5-6.2 6.5-2.6 0-4.1-1.2-5.4-3.2L5 14.6c-.6-1-.3-2 .7-2.6.8-.4 1.8-.2 2.4.6l.9 1.2"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
