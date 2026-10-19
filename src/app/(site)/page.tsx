/**
 * 首屏欢迎页 `/`（UIUX §7.1 / REQ-01）。
 *
 * 结构：
 * - 分层背景（WelcomeBackdrop）：光晕 → 虚化电脑图 → 电脑问题碎片 → 渐晕 → 噪点，五层叠出纵深
 * - 正文（店铺介绍，PRD §5.1 REQ-01-2 / 附录 C 首屏文案）：三档字级形成排版层次
 *     28/34 700 店铺身份 → 17/24 400 能解决的问题 ×1 + 服务范围 ×1 → 22/28 700 服务方式
 * - 「进 入」主按钮：宽 200px 高 50px，位于正文下 32px，跳转 /order
 * - 店名 Caption 12px 白 60%，距底部安全区 24px
 * - 入场：逐行上移淡入（100/180/260/340ms）→ 按钮淡入（480ms）
 */
import { WelcomeBackdrop } from "@/components/site/WelcomeBackdrop";
import { EnterButton } from "@/components/site/EnterButton";
import { SiteKeyframes } from "@/components/site/keyframes";
import { SHOP_NAME } from "@/lib/constants";

/** 首屏正文（PRD §5.1 REQ-01-2：一句话介绍本店；短句分行 + 三档字级） */
const WELCOME_COPY_LINES = [
  { text: "学生维修小店", className: "text-title-1 font-bold text-text-on-dark" },
  { text: "专治 发烫 · 卡顿 · 蓝屏 · 开不了机", className: "mt-3 text-body text-white/65" },
  { text: "清灰换硅脂 · 系统维护 · 免费检测", className: "text-body text-white/65" },
  {
    text: "到店立等可取，上门需预约",
    className: "mt-4 text-title-2 font-bold text-text-on-dark",
  },
] as const;

export default function WelcomePage() {
  return (
    <main className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-surface-dark px-6 tablet:px-8">
      <SiteKeyframes />
      {/* 分层背景（装饰层，aria-hidden）：光晕 / 虚化电脑图 / 问题碎片 / 渐晕 */}
      <WelcomeBackdrop />

      {/* 文案区：居中，最大宽 300px（§7.1）；整体为一段文案，逐行错开入场 */}
      <p className="relative z-(--z-content) mx-auto max-w-[300px] text-center text-shadow-on-dark text-balance tablet:max-w-[26rem] tablet:pb-2">
        {WELCOME_COPY_LINES.map((line, index) => (
          <span
            key={line.text}
            className={`xx-enter-line block ${line.className}`}
            style={{ animationDelay: `${100 + index * 80}ms` }}
          >
            {line.text}
          </span>
        ))}
      </p>

      {/* 「进 入」主按钮：文案下 32px（mt-8），宽 200px 高 50px */}
      <div className="xx-enter-btn relative z-(--z-content) mt-8 w-[200px] tablet:mt-10 tablet:w-[240px]">
        <EnterButton block>进 入</EnterButton>
      </div>

      {/* 店名 Caption：白 60%，距底部安全区 24px（§7.1） */}
      <p className="absolute inset-x-0 bottom-[calc(env(safe-area-inset-bottom,0px)+var(--space-6))] z-(--z-content) text-center text-caption text-white/60">
        {SHOP_NAME}
      </p>
    </main>
  );
}
