/**
 * CSV 导出：订单 / 售后（API 契约 §4.10）。
 *
 * - UTF-8 + BOM（Excel 双击不乱码）
 * - 转义：含逗号/引号/换行的字段用双引号包裹，内部引号转义为 ""
 * - 列顺序按契约 §4.10（订单 17 列 / 售后 10 列），禁止调整
 * - 行数上限 10000（超出 → 40001 + 提示缩小时间范围）
 */
import type { Aftersale, Order } from "@prisma/client";

import { ErrorCode } from "@/lib/constants";
import { formatDateShanghai, formatDateTimeShanghai } from "@/lib/format";
import { formatPrice } from "@/server/money";
import { ServiceError } from "@/lib/response";
import type { AftersaleDTO, OrderDTO } from "@/lib/types";

import { prisma } from "./db";

export const EXPORT_ROW_LIMIT = 10000;
export const EXPORT_ROW_LIMIT_MESSAGE = "导出数据超过 10000 行，请缩小时间范围后重试";

/** UTF-8 BOM */
export const CSV_BOM = "\uFEFF";

// ─── 转义（RFC 4180） ─────────────────────────────────────────────────────────

/**
 * CSV 单元格转义（RFC 4180 + 公式注入防护）。
 * 客户可控字段（联系人/机型/描述/地址/备注）若以 = + - @ 开头，Excel/WPS 会当公式执行，
 * 故统一前置单引号中和（OWASP CSV Injection 建议做法）。
 */
export function csvEscape(value: string | null | undefined): string {
  let v = value ?? "";
  if (/^[=+\-@\t\r]/.test(v)) {
    v = `'${v}`;
  }
  if (/[",\r\n]/.test(v)) {
    return `"${v.replaceAll('"', '""')}"`;
  }
  return v;
}

/** 一行 → CSV 文本（不带换行符） */
export function csvRow(cells: (string | number | null | undefined)[]): string {
  return cells.map((c) => csvEscape(c === null || c === undefined ? "" : String(c))).join(",");
}

// ─── 列定义（契约 §4.10 顺序） ────────────────────────────────────────────────

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "待处理",
  processing: "进行中",
  done: "已完成",
  aftersale: "售后",
  closed: "已关闭",
};
const AFTERSALE_STATUS_LABELS: Record<string, string> = {
  pending: "待处理",
  processing: "处理中",
  closed: "已关闭",
};
const SERVICE_TYPE_LABELS: Record<string, string> = { clean: "清灰换硅脂", other: "其他问题" };
const CLEAN_TIER_LABELS: Record<string, string> = { basic80: "标准清灰换硅脂 ¥80", deep100: "深度清洁 ¥100" };
const OTHER_TYPE_LABELS: Record<string, string> = {
  screen: "屏幕故障",
  wifi: "网络问题",
  slow: "系统卡顿",
  other: "其他",
};
const CONTACT_PREF_LABELS: Record<string, string> = { phone: "电话联系", wechat: "微信联系" };
const SERVICE_MODE_LABELS: Record<string, string> = { shop: "到店送修", home: "上门服务" };
const NOTIFY_STATUS_LABELS: Record<string, string> = { pending: "未发送", success: "已通知", failed: "通知失败" };

export const ORDER_CSV_HEADER = [
  "单号",
  "下单时间",
  "服务类型",
  "套餐",
  "问题类型",
  "联系人",
  "电话",
  "联系偏好",
  "机型",
  "照片数",
  "服务方式",
  "期望时间",
  "地址",
  "状态",
  "最终价格",
  "备注",
  "通知状态",
] as const;

export const AFTERSALE_CSV_HEADER = [
  "售后单号",
  "提交时间",
  "手机号",
  "关联订单",
  "保修期内",
  "问题描述",
  "照片数",
  "状态",
  "备注",
  "通知状态",
] as const;

function orderToRow(o: Order): string {
  const otherTypes = (o.otherTypes ?? []) as string[];
  const modelPhotos = (o.modelPhotos ?? []) as string[];
  return csvRow([
    o.id,
    formatDateTimeShanghai(o.createdAt),
    SERVICE_TYPE_LABELS[o.serviceType] ?? o.serviceType,
    o.cleanTier ? (CLEAN_TIER_LABELS[o.cleanTier] ?? o.cleanTier) : "",
    otherTypes.map((t) => OTHER_TYPE_LABELS[t] ?? t).join("、"),
    o.contactName,
    o.phone,
    CONTACT_PREF_LABELS[o.contactPref] ?? o.contactPref,
    o.brandModel,
    modelPhotos.length,
    SERVICE_MODE_LABELS[o.serviceMode] ?? o.serviceMode,
    o.preferredTime ?? "尽快",
    o.address ?? "",
    ORDER_STATUS_LABELS[o.status] ?? o.status,
    formatPrice(o.finalPrice) ?? "",
    o.remark ?? "",
    NOTIFY_STATUS_LABELS[o.notifyStatus] ?? o.notifyStatus,
  ]);
}

function aftersaleToRow(a: Aftersale): string {
  const media = (a.media ?? []) as string[];
  return csvRow([
    a.id,
    formatDateTimeShanghai(a.createdAt),
    a.phone,
    a.orderId ?? "",
    a.inWarranty ? "是" : "否",
    a.description,
    media.length,
    AFTERSALE_STATUS_LABELS[a.status] ?? a.status,
    a.remark ?? "",
    NOTIFY_STATUS_LABELS[a.notifyStatus] ?? a.notifyStatus,
  ]);
}

// ─── 导出主体 ─────────────────────────────────────────────────────────────────

export type ExportFilter = {
  status?: string;
  /** yyyy-MM-dd（Asia/Shanghai，含首尾） */
  from?: string;
  to?: string;
};

/** yyyy-MM-dd（Shanghai）→ UTC 起止 [当日 00:00, 次日 00:00)（Asia/Shanghai = UTC+8） */
function dayBounds(dateStr: string): { start: Date; end: Date } {
  const parts = dateStr.split("-");
  const y = Number.parseInt(parts[0] ?? "", 10);
  const m = Number.parseInt(parts[1] ?? "", 10);
  const d = Number.parseInt(parts[2] ?? "", 10);
  if (!y || !m || !d) throw new ServiceError(ErrorCode.BAD_REQUEST, "日期格式应为 yyyy-MM-dd");
  const start = new Date(Date.UTC(y, m - 1, d) - 8 * 3600 * 1000);
  return { start, end: new Date(start.getTime() + 24 * 3600 * 1000) };
}

export function buildWhere(filter: ExportFilter) {
  const where: { status?: string; createdAt?: { gte?: Date; lte?: Date } } = {};
  if (filter.status) where.status = filter.status;
  if (filter.from || filter.to) {
    const createdAt: { gte?: Date; lte?: Date } = {};
    if (filter.from) {
      createdAt.gte = dayBounds(filter.from).start;
    }
    if (filter.to) {
      createdAt.lte = new Date(dayBounds(filter.to).end.getTime() - 1); // 含首尾
    }
    where.createdAt = createdAt;
  }
  return where;
}

/** 导出文件名：orders_20261005.csv（契约 §4.10） */
export function exportFilename(type: "orders" | "aftersales", now: Date = new Date()): string {
  const key = formatDateShanghai(now).replaceAll("-", "");
  return `${type}_${key}.csv`;
}

/**
 * 生成订单 CSV（BOM + 表头 + 数据行，CRLF 行尾）。
 * 行数超过 10000 → 40001 + 提示缩小时间范围（契约 §4.10）。
 */
export async function exportOrdersCsv(filter: ExportFilter = {}): Promise<string> {
  const rows = await prisma.order.findMany({
    where: buildWhere(filter),
    orderBy: { createdAt: "desc" },
    take: EXPORT_ROW_LIMIT + 1,
  });
  if (rows.length > EXPORT_ROW_LIMIT) {
    throw new ServiceError(ErrorCode.BAD_REQUEST, EXPORT_ROW_LIMIT_MESSAGE);
  }
  const lines = [csvRow([...ORDER_CSV_HEADER]), ...rows.map(orderToRow)];
  return CSV_BOM + lines.join("\r\n") + "\r\n";
}

/** 生成售后 CSV（同上） */
export async function exportAftersalesCsv(filter: ExportFilter = {}): Promise<string> {
  const rows = await prisma.aftersale.findMany({
    where: buildWhere(filter),
    orderBy: { createdAt: "desc" },
    take: EXPORT_ROW_LIMIT + 1,
  });
  if (rows.length > EXPORT_ROW_LIMIT) {
    throw new ServiceError(ErrorCode.BAD_REQUEST, EXPORT_ROW_LIMIT_MESSAGE);
  }
  const lines = [csvRow([...AFTERSALE_CSV_HEADER]), ...rows.map(aftersaleToRow)];
  return CSV_BOM + lines.join("\r\n") + "\r\n";
}
