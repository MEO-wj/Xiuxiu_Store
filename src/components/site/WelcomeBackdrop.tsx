/**
 * 首屏欢迎页分层背景（UIUX §7.1 / REQ-01）。
 *
 * 图层结构（自下而上；编号与 UIUX §7.1 一致）：
 * L0 深空蓝底 + 3 团光晕缓慢漂移（GlowBackdrop，永远存在、零下载、永不空白）
 * L1 虚化电脑图形：内联 SVG 笔记本 + 屏幕辉光，10/15/18px 模糊（移动/平板/桌面），半透明，52s 极缓呼吸
 * L2 电脑问题短句碎片：8 条（+2 条仅在 ≥768px 出现），远近两层制造景深
 * L3 中心渐晕 + 上下压暗（保证主文案在任意背景下的对比度，§10）
 * L4 细颗粒噪点：叠于渐晕之上，消除大面积渐变的色带（权重极低，仅质感）
 * 整个背景组 aria-hidden + pointer-events-none，位于 --z-bg。
 *
 * 约束（§2.3 避免项 / §8）：
 * - 动画仅驱动 transform / opacity（GPU 合成，不触发重排）；周期 38–52s，无闪烁
 * - 不使用粒子风暴、发光描边、拟物阴影；碎片仅用白字不同透明度表达远近
 * - prefers-reduced-motion：globals.css 全局降级为静态，色彩层次保留
 * - 碎片定位以 375×812 基准稿标定，避开中央文案带（约 y 26%–70% 的中心区域）
 */
import { GlowBackdrop } from "./GlowBackdrop";

/** 一条背景碎片（电脑问题的口语化短句） */
type SceneFragment = {
  text: string;
  /** 绝对定位（百分比，相对 100dvh 容器）：已避开中央文案带 */
  place: string;
  /** 景深：near 更亮更实；far 更淡且轻微模糊 */
  depth: "near" | "far";
  /** 漂移节奏：两套周期错开，避免整片同步移动 */
  drift: "xx-drift-soft" | "xx-drift-diag";
  /** 负延迟：让动画从中途开始，开局即"已在漂移" */
  delay: string;
};

const FRAGMENTS: SceneFragment[] = [
  // ── 上半区（基准稿 y < 30%）──
  { text: "风扇像要起飞", place: "top-[10%] left-[7%]", depth: "near", drift: "xx-drift-soft", delay: "-6s" },
  { text: "开机要等三分钟", place: "top-[7%] left-[35%]", depth: "near", drift: "xx-drift-diag", delay: "-21s" },
  { text: "一碰就烫手", place: "top-[22%] left-[12%]", depth: "far", drift: "xx-drift-diag", delay: "-33s" },
  { text: "打字都掉帧", place: "top-[24%] right-[14%]", depth: "far", drift: "xx-drift-soft", delay: "-14s" },
  // ── 下半区（基准稿 y > 70%）；靠下两条刻意避开主按钮的横向范围（按钮居中，宽度 200px）──
  { text: "又蓝屏了", place: "bottom-[28%] left-[4%]", depth: "near", drift: "xx-drift-diag", delay: "-27s" },
  { text: "关机了还发烫", place: "bottom-[24%] right-[9%]", depth: "far", drift: "xx-drift-soft", delay: "-41s" },
  { text: "噪音比空调还大", place: "bottom-[15%] left-[9%]", depth: "far", drift: "xx-drift-soft", delay: "-18s" },
  { text: "屏幕一闪一闪", place: "bottom-[11%] right-[8%]", depth: "near", drift: "xx-drift-diag", delay: "-37s" },
  // ── 仅宽屏出现：把两侧留白用起来，桌面端不显空 ──
  { text: "散热器积灰了", place: "hidden tablet:block top-[34%] left-[19%]", depth: "far", drift: "xx-drift-diag", delay: "-9s" },
  { text: "硅脂干掉了", place: "hidden tablet:block bottom-[31%] right-[17%]", depth: "near", drift: "xx-drift-soft", delay: "-25s" },
];

/** 极细噪点（内联 SVG，无额外文件下载） */
const GRAIN =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='140' height='140'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='140' height='140' filter='url(%23n)'/%3E%3C/svg%3E\")";

/**
 * 虚化电脑图形的美术用色（集中定义，不散落在 JSX 里；§3.1「禁止硬编码零散色值」）。
 * 取值由设计令牌派生：机身黑 = --color-surface-dark(#0A1220)，屏幕主光 = --color-primary(#2F6BFF)，
 * 屏幕冷光 = --color-glow-b(#22D3EE)，轮廓高光为其提亮色。SVG 渐变/描边不引用 var()（微信 X5 内核兼容性），
 * 因此统一在此处命名，修改时只改这一处。
 */
const SCENE = {
  body: "#0a1220",
  edge: "#a8dcff",
  key: "#cfe9ff",
  screenCore: "#cfeeff",
  screenMid: "#5aa9ff",
  screenDeep: "#2f6bff",
  halo: "#4c9bff",
} as const;

/**
 * 虚化的电脑图形：一台打开的笔记本（屏幕 + 键盘面）。
 * 造型策略：深色背景上“靠光而不靠块”——用亮线勾勒机身轮廓 + 屏幕自身的辉光，
 * 因此即使重度模糊，仍能读出“一台电脑在那儿亮着/发烫”的轮廓，而不是一团亮斑。
 */
function BlurredLaptop() {
  return (
    <svg viewBox="0 0 800 480" className="size-full" aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id="xx-scene-screen" cx="50%" cy="42%" r="66%">
          <stop offset="0%" stopColor={SCENE.screenCore} stopOpacity="0.68" />
          <stop offset="50%" stopColor={SCENE.screenMid} stopOpacity="0.4" />
          <stop offset="100%" stopColor={SCENE.screenDeep} stopOpacity="0.04" />
        </radialGradient>
        <radialGradient id="xx-scene-halo" cx="50%" cy="50%" r="56%">
          <stop offset="0%" stopColor={SCENE.halo} stopOpacity="0.3" />
          <stop offset="62%" stopColor={SCENE.screenDeep} stopOpacity="0.14" />
          <stop offset="100%" stopColor={SCENE.body} stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* 环境辉光（最底层，只负责“亮”，不负责形） */}
      <ellipse cx="400" cy="240" rx="360" ry="240" fill="url(#xx-scene-halo)" />

      {/* 键盘面（机身）：比屏幕宽的梯形，读“笔记本”的关键一层 */}
      <path d="M185 300 H615 L690 440 H110 Z" fill={SCENE.body} fillOpacity="0.5" />
      {/* 键位纹理 */}
      <g fill={SCENE.key} fillOpacity="0.14">
        {[0, 1, 2, 3].map((row) =>
          [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((col) => (
            <rect
              key={`${row}-${col}`}
              x={215 + col * 32}
              y={318 + row * 22}
              width={26}
              height={13}
              rx={3}
            />
          )),
        )}
      </g>
      {/* 触控板 */}
      <rect x="348" y="402" width="104" height="22" rx="5" fill={SCENE.key} fillOpacity="0.12" />
      <path
        d="M185 300 H615 L690 440 H110 Z"
        fill="none"
        stroke={SCENE.edge}
        strokeOpacity="0.55"
        strokeWidth="7"
        strokeLinejoin="round"
      />

      {/* 屏幕：先铺机身底色 → 再上发光内屏 → 最后描亮边（顺序不能反，否则机身盖住屏幕光） */}
      <rect x="190" y="40" width="420" height="260" rx="16" fill={SCENE.body} fillOpacity="0.62" />
      <rect x="208" y="58" width="384" height="224" rx="10" fill="url(#xx-scene-screen)" />
      <rect
        x="190"
        y="40"
        width="420"
        height="260"
        rx="16"
        fill="none"
        stroke={SCENE.edge}
        strokeOpacity="0.8"
        strokeWidth="8"
      />
    </svg>
  );
}

export function WelcomeBackdrop() {
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-(--z-bg) overflow-hidden"
    >
      {/* L0 动态兜底背景：深空蓝 + 光晕，永远存在 */}
      <GlowBackdrop blobs={3} />

      {/* L1 虚化电脑图形：外层负责定位/居中，内层负责动画（避免 transform 相互覆盖） */}
      <div className="xx-enter-bg absolute inset-x-0 bottom-[-7%] flex justify-center overflow-hidden">
        <div className="xx-drift-device w-[150%] shrink-0 opacity-70 blur-[10px] tablet:w-[86%] tablet:blur-[15px] desktop:w-[62%] desktop:max-w-[42rem] desktop:blur-[18px]">
          <BlurredLaptop />
        </div>
      </div>

      {/* L2 电脑问题碎片：整组淡入（外层）→ 每条各自漂移（内层），避免 animation 简写相互覆盖 */}
      <div className="xx-enter-bg absolute inset-0">
        {FRAGMENTS.map((fragment) => (
          <span
            key={`${fragment.text}-${fragment.place}`}
            className={[
              "absolute select-none whitespace-nowrap",
              fragment.place,
              fragment.depth === "near"
                ? "text-subheadline font-medium text-white/30"
                : "text-footnote text-white/15 blur-[0.7px]",
              fragment.drift,
            ].join(" ")}
            style={{ animationDelay: fragment.delay }}
          >
            {fragment.text}
          </span>
        ))}
      </div>

      {/* L3 中心渐晕 + 上下压暗：主文案对比度兜底（§10）。
          色值等价于 --color-surface-dark(#0A1220)：此处故意用字面 rgba 而不走 color-mix(var(--…))，
          因为一旦某内核不支持 color-mix，整条 background 会失效、可读性兜底会整体丢失；
          与 Hero.tsx 的遮罩层做法保持一致。 */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(62% 34% at 50% 50%, rgba(10,18,32,.9) 0%, rgba(10,18,32,.58) 58%, rgba(10,18,32,0) 100%)," +
            "linear-gradient(180deg, rgba(10,18,32,.62) 0%, rgba(10,18,32,0) 24%, rgba(10,18,32,0) 70%, rgba(10,18,32,.5) 100%)",
        }}
      />

      {/* L4 细颗粒：叠于渐晕之上，消除大面积渐变的色带（权重极低，仅质感） */}
      <div className="absolute inset-0 opacity-[.045]" style={{ backgroundImage: GRAIN }} />
    </div>
  );
}
