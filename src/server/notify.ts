/**
 * 通知推送：wecom / serverchan / console 三通道（NOTIFY_PROVIDER 选择）。
 *
 * 口径：PRD §6.1（模板原文，字段不得增删）、开发文档 §5.3、数据库契约 §3.4。
 * - 模板必须包含：类型（含套餐与保修）/ 联系人 / 电话 / 联系偏好 / 机型（含照片数）/
 *   故障 / 服务方式（上门高亮 + 期望时间 + 排期提示）/ 地址
 * - 失败不阻断主流程（契约 §8：通知不进主事务）；写 notification_logs（success/failed + payload + error）
 * - 回写 orders/aftersales.notify_status 由调用方（service 层）完成
 */
import {
  CLEAN_TIER_SHORT_LABELS,
  OTHER_TYPE_LABELS,
  SERVICE_TYPE_LABELS,
  SHOP_NAME,
} from "@/lib/constants";
import type { NotifyChannel } from "@/lib/constants";
import { formatDateShanghai, preferredTimeLabel } from "@/lib/format";
import type { OrderDTO, OrderSummaryRef } from "@/lib/types";

import { prisma } from "./db";

// ─── 通知内容类型 ─────────────────────────────────────────────────────────────

export type OrderNotifyPayload = {
  kind: "order";
  order: OrderDTO;
};

export type AftersaleNotifyPayload = {
  kind: "aftersale";
  aftersaleId: string;
  phone: string;
  description: string;
  /** 关联订单（可空）与保修快照 */
  order: OrderSummaryRef | null;
  inWarranty: boolean;
};

export type NotifyPayload = OrderNotifyPayload | AftersaleNotifyPayload;

// ─── 模板组装（PRD §6.1 结构，字段全量） ──────────────────────────────────────

function orderTypeLine(order: OrderDTO): string {
  if (order.serviceType === "clean") {
    const tier = order.cleanTier ?? "basic80";
    return `类型：${SERVICE_TYPE_LABELS.clean} · ${CLEAN_TIER_SHORT_LABELS[tier]}（含 7 天保修）`;
  }
  const types = (order.otherTypes ?? []).map((t) => OTHER_TYPE_LABELS[t]).join("、");
  return `类型：${SERVICE_TYPE_LABELS.other}（${types.length > 0 ? types : "未选择"} · 免费检测报价后维修）`;
}

function contactPrefLine(pref: string): string {
  if (pref === "wechat") {
    return "联系偏好：💬 微信（会加官方微信；若 30 分钟无响应，可改电话联系）";
  }
  return "联系偏好：📞 电话";
}

function serviceModeLine(order: OrderDTO): string {
  if (order.serviceMode === "home") {
    return `服务方式：🚪 上门（期望：${preferredTimeLabel(order.preferredTime)}）—— 需排期；费用单独沟通确认`;
  }
  return `服务方式：🏬 到店（期望：${preferredTimeLabel(order.preferredTime)}）`;
}

function addressLine(order: OrderDTO): string {
  if (order.serviceMode !== "home") return "地址：—（到店送修）";
  return `地址：${order.address && order.address.length > 0 ? order.address : "待沟通确认时补充"}`;
}

/** 新订单通知模板（PRD §6.1「新订单通知模板」，全部字段） */
export function buildOrderMessage(order: OrderDTO): string {
  const photos = order.modelPhotos?.length ?? 0;
  return [
    `【${SHOP_NAME} · 新订单 ${order.id}】`,
    orderTypeLine(order),
    `联系人：${order.contactName}  ${order.phone}`,
    contactPrefLine(order.contactPref),
    `机型：${order.brandModel}${photos > 0 ? `（照片 ${photos} 张）` : ""}`,
    `故障：${order.description && order.description.length > 0 ? order.description : "—"}`,
    serviceModeLine(order),
    addressLine(order),
  ].join("\n");
}

/** 售后通知模板（PRD §6.1「售后通知模板」） */
export function buildAftersaleMessage(input: {
  aftersaleId: string;
  phone: string;
  description: string;
  order: OrderSummaryRef | null;
  inWarranty: boolean;
}): string {
  const lines = [
    `【${SHOP_NAME} · 售后报修 ${input.aftersaleId}】`,
    `手机号：${input.phone}`,
  ];
  if (input.order) {
    const type =
      input.order.serviceType === "clean"
        ? `${SERVICE_TYPE_LABELS.clean} ${input.order.cleanTier ? CLEAN_TIER_SHORT_LABELS[input.order.cleanTier] : ""}`.trim()
        : SERVICE_TYPE_LABELS.other;
    const warrantyMark = input.inWarranty ? "7 天内 ✓" : "已超 7 天保修期";
    lines.push(
      `关联订单：${input.order.id} ${type}（${formatDateShanghai(input.order.createdAt)}，${warrantyMark}）`,
    );
  } else {
    lines.push("关联订单：未匹配到（提交时未查询到该手机号订单）");
  }
  lines.push(`问题：${input.description}`);
  return lines.join("\n");
}

// ─── 通道发送 ─────────────────────────────────────────────────────────────────

export type SendResult = { status: "success" | "failed"; error?: string };

/** 当前生效通道（NOTIFY_PROVIDER，缺省 console） */
export function currentChannel(): NotifyChannel {
  const provider = (process.env.NOTIFY_PROVIDER ?? "console").toLowerCase();
  if (provider === "wecom" || provider === "serverchan" || provider === "console") return provider;
  return "console";
}

/** 企微机器人：markdown 消息 POST webhook */
async function sendWecom(message: string): Promise<SendResult> {
  const url = process.env.WECOM_WEBHOOK_URL;
  if (!url) return { status: "failed", error: "WECOM_WEBHOOK_URL 未配置" };
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ msgtype: "markdown", markdown: { content: message } }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { status: "failed", error: `HTTP ${res.status}` };
    const body = (await res.json().catch(() => null)) as { errcode?: number; errmsg?: string } | null;
    if (body && typeof body.errcode === "number" && body.errcode !== 0) {
      return { status: "failed", error: `wecom errcode=${body.errcode} ${body.errmsg ?? ""}`.slice(0, 480) };
    }
    return { status: "success" };
  } catch (e) {
    return { status: "failed", error: (e instanceof Error ? e.message : String(e)).slice(0, 480) };
  }
}

/** Server 酱：POST https://sctapi.ftqq.com/{KEY}.send */
async function sendServerchan(message: string): Promise<SendResult> {
  const key = process.env.SERVERCHAN_KEY;
  if (!key) return { status: "failed", error: "SERVERCHAN_KEY 未配置" };
  try {
    const res = await fetch(`https://sctapi.ftqq.com/${encodeURIComponent(key)}.send`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ title: `${SHOP_NAME} 新消息`, desp: message }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return { status: "failed", error: `HTTP ${res.status}` };
    const body = (await res.json().catch(() => null)) as { code?: number; message?: string } | null;
    if (body && typeof body.code === "number" && body.code !== 0) {
      return { status: "failed", error: `serverchan code=${body.code} ${body.message ?? ""}`.slice(0, 480) };
    }
    return { status: "success" };
  } catch (e) {
    return { status: "failed", error: (e instanceof Error ? e.message : String(e)).slice(0, 480) };
  }
}

/** 本地开发：打印终端（始终成功） */
function sendConsole(message: string): SendResult {
  console.log(`\n========== 通知（console 通道） ==========\n${message}\n========================================\n`);
  return { status: "success" };
}

/** 按通道发送（不发日志，不写库；调用方见 sendAndLog） */
export async function sendByChannel(channel: NotifyChannel, message: string): Promise<SendResult> {
  switch (channel) {
    case "wecom":
      return sendWecom(message);
    case "serverchan":
      return sendServerchan(message);
    default:
      return sendConsole(message);
  }
}

// ─── 发送 + 落库（唯一入口，失败不抛错） ─────────────────────────────────────

export type NotifyOutcome = {
  channel: NotifyChannel;
  status: "success" | "failed";
  error?: string;
  payload: string;
};

/**
 * 组装 → 发送 → 写 notification_logs。
 * 任何异常（含写日志失败）都不向上抛（契约 §8：通知失败不回滚订单/售后）。
 * @returns 发送结果，调用方据此回写 notify_status。
 */
export async function sendAndLog(payload: NotifyPayload): Promise<NotifyOutcome> {
  const channel = currentChannel();
  const message =
    payload.kind === "order" ? buildOrderMessage(payload.order) : buildAftersaleMessage(payload);

  let result: SendResult;
  try {
    result = await sendByChannel(channel, message);
  } catch (e) {
    // 理论上 sendByChannel 内部已捕获；双保险
    result = { status: "failed", error: (e instanceof Error ? e.message : String(e)).slice(0, 480) };
  }

  try {
    await prisma.notificationLog.create({
      data: {
        orderId: payload.kind === "order" ? payload.order.id : null,
        aftersaleId: payload.kind === "aftersale" ? payload.aftersaleId : null,
        channel,
        status: result.status,
        payload: message,
        error: result.error ?? null,
      },
    });
  } catch (e) {
    // 日志写失败也不阻断主流程
    console.error("[notify] notification_logs 写入失败：", e);
  }

  return { channel, status: result.status, error: result.error, payload: message };
}
