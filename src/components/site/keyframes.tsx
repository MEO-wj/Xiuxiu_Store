/**
 * C 端站点级一次性动画样式（UIUX §8.3 动效清单）。
 *
 * 设计令牌（时长 / 曲线 / 颜色）全部引用 globals.css 的 CSS 变量；
 * 本文件只补充 globals.css 未定义的少量 keyframes（光晕漂移 / 弹层入场 / 首屏入场 / 成功对勾）。
 * 通过 React 19 <style href precedence> 挂载，多处渲染自动去重。
 *
 * prefers-reduced-motion：globals.css 已全局降级（动画时长 0.01ms），此处无需重复处理。
 */
export function SiteKeyframes() {
  return <style href="xiuxiu-site-keyframes" precedence="medium">{SITE_KEYFRAME_CSS}</style>;
}

const SITE_KEYFRAME_CSS = `
@keyframes xiuxiu-glow-a { 0%,100% { transform: translate3d(-4%,-3%,0) scale(1); } 50% { transform: translate3d(4%,3%,0) scale(1.08); } }
@keyframes xiuxiu-glow-b { 0%,100% { transform: translate3d(3%,4%,0) scale(1.05); } 50% { transform: translate3d(-3%,-4%,0) scale(1); } }
@keyframes xiuxiu-glow-c { 0%,100% { transform: translate3d(0,4%,0) scale(1.02); } 50% { transform: translate3d(0,-4%,0) scale(1.08); } }
@keyframes xiuxiu-fade-in { from { opacity: 0; } to { opacity: 1; } }
@keyframes xiuxiu-fade-up { from { opacity: 0; transform: translateY(14px); } to { opacity: 1; transform: translateY(0); } }
@keyframes xiuxiu-sheet-in { from { transform: translateY(100%); } to { transform: translateY(0); } }
@keyframes xiuxiu-success-pop { 0% { transform: scale(.5); opacity: 0; } 70% { transform: scale(1.06); opacity: 1; } 100% { transform: scale(1); opacity: 1; } }
@keyframes xiuxiu-drift-soft { 0%,100% { transform: translate3d(0,0,0); } 50% { transform: translate3d(0,-9px,0); } }
@keyframes xiuxiu-drift-diag { 0%,100% { transform: translate3d(0,0,0); } 50% { transform: translate3d(8px,6px,0); } }
@keyframes xiuxiu-device-breathe { 0%,100% { transform: translate3d(0,0,0) scale(1); } 50% { transform: translate3d(-1.5%,-2%,0) scale(1.04); } }

.xx-glow { position: absolute; border-radius: 50%; will-change: transform; pointer-events: none; }
.xx-anim-glow-a { animation: xiuxiu-glow-a 28s var(--ease-in-out) infinite; }
.xx-anim-glow-b { animation: xiuxiu-glow-b 24s var(--ease-in-out) infinite; animation-delay: -8s; }
.xx-anim-glow-c { animation: xiuxiu-glow-c 30s var(--ease-in-out) infinite; animation-delay: -16s; }
.xx-fade-in { animation: xiuxiu-fade-in var(--dur-fast) var(--ease-gentle) both; }
.xx-fade-up { animation: xiuxiu-fade-up var(--dur-base) var(--ease-gentle) both; }
.xx-sheet-in { animation: xiuxiu-sheet-in var(--dur-sheet) var(--ease-spring) both; }
.xx-success-pop { animation: xiuxiu-success-pop var(--dur-sheet) var(--ease-spring) both; }
/* 首屏入场（UIUX §7.1）：文案逐行上移淡入（每行延迟由组件内联指定）→ 按钮淡入 480ms */
.xx-enter-btn { animation: xiuxiu-fade-in 400ms var(--ease-gentle) 480ms both; }
/* 首屏分层背景（UIUX §7.1）：整层缓入 + 碎片/电脑图的极缓漂移（38–52s，仅 transform） */
.xx-enter-bg { animation: xiuxiu-fade-in 900ms var(--ease-gentle) both; }
.xx-drift-soft { animation: xiuxiu-drift-soft 38s var(--ease-in-out) infinite; }
.xx-drift-diag { animation: xiuxiu-drift-diag 46s var(--ease-in-out) infinite; }
.xx-drift-device { animation: xiuxiu-device-breathe 52s var(--ease-in-out) infinite; }
/* 文案逐行错开入场：每行独立延迟（用内联 animation-delay 指定） */
.xx-enter-line { animation: xiuxiu-fade-up 420ms var(--ease-gentle) both; }
`;
