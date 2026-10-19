"use client";

/** 状态徽标（UIUX §6.9 配色） */
const ORDER_STATUS_STYLE: Record<string, { label: string; bg: string; color: string }> = {
  pending: { label: "待处理", bg: "var(--color-badge-pending-bg)", color: "var(--color-badge-pending-ink)" },
  processing: { label: "进行中", bg: "var(--color-primary-soft)", color: "var(--color-primary)" },
  done: { label: "已完成", bg: "var(--color-badge-done-bg)", color: "var(--color-badge-done-ink)" },
  aftersale: { label: "售后", bg: "var(--color-badge-aftersale-bg)", color: "var(--color-badge-aftersale-ink)" },
  closed: { label: "已关闭", bg: "var(--color-badge-closed-bg)", color: "var(--color-badge-closed-ink)" },
};

const AFTERSALE_STATUS_STYLE: Record<string, { label: string; bg: string; color: string }> = {
  pending: { label: "待处理", bg: "var(--color-badge-pending-bg)", color: "var(--color-badge-pending-ink)" },
  processing: { label: "处理中", bg: "var(--color-primary-soft)", color: "var(--color-primary)" },
  closed: { label: "已关闭", bg: "var(--color-badge-closed-bg)", color: "var(--color-badge-closed-ink)" },
};

export function StatusBadge({ status, kind = "order" }: { status: string; kind?: "order" | "aftersale" }) {
  const table = kind === "order" ? ORDER_STATUS_STYLE : AFTERSALE_STATUS_STYLE;
  const style = table[status] ?? { label: status, bg: "var(--color-badge-closed-bg)", color: "var(--color-badge-closed-ink)" };
  return (
    <span
      className="inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium"
      style={{ backgroundColor: style.bg, color: style.color }}
    >
      {style.label}
    </span>
  );
}

/** 上门 / 微信偏好标记（PRD §6.2：加图标 + 加粗） */
export function ServiceTags({ serviceMode, contactPref }: { serviceMode: string; contactPref: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-xs font-semibold">
      {serviceMode === "home" ? <span title="上门服务">🚪 上门</span> : <span className="font-normal text-[var(--color-label-2)]">🏪 到店</span>}
      {contactPref === "wechat" ? <span title="微信联系">💬 微信</span> : <span className="font-normal text-[var(--color-label-2)]">📞 电话</span>}
    </span>
  );
}
