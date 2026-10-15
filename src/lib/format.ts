/**
 * 格式化与纯函数业务工具：单号 / 金额 / 时间 / 保修 / 营业时间 / 时效文案。
 *
 * 口径：
 *  - 时间：库内存 UTC，展示与营业时间判断统一 Asia/Shanghai（数据库契约 §1，禁用本地时区）
 *  - 保修：交付日计第 1 天、共 7 自然日、截止日 = 交付日 + 6 天（契约 I9，单一函数）
 *  - 单号：R/A + yyyyMMdd + '-' + 3 位流水，>999 扩 4 位（契约 §7）
 *  - 金额：Decimal 字符串两位小数，禁浮点（契约 §1）
 */
import {
  BUSINESS_HOURS_END,
  BUSINESS_HOURS_START,
  ETA_TEXT_AFTERSALE,
  ETA_TEXT_BUSINESS_HOURS,
  ETA_TEXT_OFF_HOURS,
  TIMEZONE,
  WARRANTY_DAYS,
} from "./constants";

// ─── 时间（Asia/Shanghai 专用工具，禁止依赖服务器本地时区） ───────────────────

/**
 * 取任意时刻在 Asia/Shanghai 时区的「日历部件」。
 * 用 Intl.DateTimeFormat formatToParts，跨运行时稳定。
 */
export function shanghaiParts(date: Date): {
  year: number;
  month: number; // 1–12
  day: number;
  hour: number;
  minute: number;
  second: number;
} {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const map: Record<string, string> = {};
  for (const part of fmt.formatToParts(date)) {
    map[part.type] = part.value;
  }
  // hour12:false 在部分环境输出 "24"，归一为 0
  const hour = Number.parseInt(map["hour"] ?? "0", 10) % 24;
  return {
    year: Number.parseInt(map["year"] ?? "0", 10),
    month: Number.parseInt(map["month"] ?? "1", 10),
    day: Number.parseInt(map["day"] ?? "1", 10),
    hour,
    minute: Number.parseInt(map["minute"] ?? "0", 10),
    second: Number.parseInt(map["second"] ?? "0", 10),
  };
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}
function pad3(n: number): string {
  return n < 100 ? `0${pad2(n)}` : String(n);
}
function pad4(n: number): string {
  return n < 1000 ? `0${pad3(n)}` : String(n);
}

/** yyyy-MM-dd（Asia/Shanghai 日历日） */
export function formatDateShanghai(date: Date): string {
  const p = shanghaiParts(date);
  return `${pad4(p.year)}-${pad2(p.month)}-${pad2(p.day)}`;
}

/** yyyy-MM-dd HH:mm（Asia/Shanghai） */
export function formatDateTimeShanghai(date: Date): string {
  const p = shanghaiParts(date);
  return `${formatDateShanghai(date)} ${pad2(p.hour)}:${pad2(p.minute)}`;
}

/** yyyyMMdd（Asia/Shanghai，单号用） */
export function dateKeyShanghai(date: Date): string {
  const p = shanghaiParts(date);
  return `${pad4(p.year)}${pad2(p.month)}${pad2(p.day)}`;
}

/**
 * Asia/Shanghai 自然日边界：返回 [当日 00:00, 次日 00:00) 的 UTC 时刻。
 * 用于「当日 5 单限流」（契约 §1.6：Asia/Shanghai 自然日）与后台 from/to 筛选。
 */
export function shanghaiDayRange(date: Date): { start: Date; end: Date } {
  const key = dateKeyShanghai(date);
  const y = Number.parseInt(key.slice(0, 4), 10);
  const m = Number.parseInt(key.slice(4, 6), 10);
  const d = Number.parseInt(key.slice(6, 8), 10);
  // Asia/Shanghai = UTC+8（无夏令时，固定偏移）
  const start = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0) - 8 * 3600 * 1000);
  const end = new Date(start.getTime() + 24 * 3600 * 1000);
  return { start, end };
}

// ─── 营业时间判定（9:00–17:00, Asia/Shanghai；API 契约 §3.1） ─────────────────

/** 是否营业时间：[9:00, 17:00)（9:00 整营业中；17:00 整已下班） */
export function isBusinessHours(date: Date): boolean {
  const p = shanghaiParts(date);
  const minutes = p.hour * 60 + p.minute;
  return minutes >= BUSINESS_HOURS_START * 60 && minutes < BUSINESS_HOURS_END * 60;
}

/** 联系时效文案（成功页 / 下单响应共用，开发文档 §5.7） */
export function etaText(date: Date): string {
  return isBusinessHours(date) ? ETA_TEXT_BUSINESS_HOURS : ETA_TEXT_OFF_HOURS;
}

/** 售后提交成功文案（固定，PRD §5.3） */
export function aftersaleEtaText(): string {
  return ETA_TEXT_AFTERSALE;
}

// ─── 保修（单一函数，契约 I9：交付日=第 1 天，共 7 自然日，截止日=交付日+6 天） ──

/**
 * 保修截止日（Asia/Shanghai 日历日，yyyy-MM-dd）。
 * 交付日以订单 created_at 近似（契约 §3.2 注释）；交付日计第 1 天 → 截止 = 交付日 + 6 天。
 */
export function warrantyEndDate(deliveredAt: Date): string {
  const { start } = shanghaiDayRange(deliveredAt);
  return formatDateShanghai(new Date(start.getTime() + (WARRANTY_DAYS - 1) * 24 * 3600 * 1000));
}

/**
 * 是否在保修期内：写入/查询时刻（Asia/Shanghai 日历日）≤ 截止日。
 * 即交付日当天、+1 … +6 天均为保修期内；+7 天起超出。
 */
export function isInWarranty(deliveredAt: Date, now: Date): boolean {
  return formatDateShanghai(now) <= warrantyEndDate(deliveredAt);
}

// ─── 单号（契约 §7：R/A + yyyyMMdd + '-' + 3 位流水，>999 扩 4 位） ────────────

/** 单号前缀 */
export const ORDER_ID_PREFIX = "R";
export const AFTERSALE_ID_PREFIX = "A";

/**
 * 拼单号：prefix + yyyyMMdd + '-' + 流水（3 位，>999 时自然扩为 4 位）。
 * @param seq 当日已有单数（流水 = seq + 1，由调用方传入计数）
 */
export function buildSerialId(prefix: "R" | "A", date: Date, seq: number): string {
  const serial = seq + 1;
  const serialStr = serial > 999 ? String(serial) : pad3(serial);
  return `${prefix}${dateKeyShanghai(date)}-${serialStr}`;
}

export type ParsedSerialId = {
  prefix: "R" | "A";
  dateKey: string; // yyyyMMdd
  serial: number; // 流水数字（3 位或 4 位）
};

/** 解析单号（用于服务端校验；非法返回 null）。前端不得做数学运算或位数解析（契约 §7）。 */
export function parseSerialId(id: string): ParsedSerialId | null {
  const m = /^([RA])(\d{8})-(\d{3,4})$/.exec(id.trim());
  if (!m) return null;
  const prefix = m[1] as "R" | "A";
  const dateKey = m[2] ?? "";
  const serialStr = m[3] ?? "0";
  if (!/^\d{4}(0[1-9]|1[0-2])(0[1-9]|[12]\d|3[01])$/.test(dateKey)) return null;
  return { prefix, dateKey, serial: Number.parseInt(serialStr, 10) };
}

/** 当日单号 LIKE 前缀（开发文档 §3.6：SELECT … WHERE id LIKE 'R20261005-%'） */
export function serialIdLikePrefix(prefix: "R" | "A", date: Date): string {
  return `${prefix}${dateKeyShanghai(date)}-%`;
}

// ─── 金额 ────────────────────────────────────────────────────────────────────
//
// 金额格式化需要 Prisma Decimal（服务端专用），已下沉到 `@/server/money`，
// 避免 `@prisma/client/runtime` 被打进客户端 bundle（会导致 node:fs 打包失败）。

// ─── 通知/展示派生文案（PRD §8 注：存储值口径，「明天下午」仅派生） ──────────────

/** 期望时间展示：null → 尽快（默认值） */
export function preferredTimeLabel(preferredTime: string | null | undefined): string {
  return preferredTime && preferredTime.length > 0 ? preferredTime : "尽快";
}
