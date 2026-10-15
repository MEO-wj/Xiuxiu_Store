/**
 * 订单业务（数据库契约 §8 事务边界 / API 契约 §3.1、§4.4–§4.6、§5）。
 *
 * 创建链（顺序不可变，API 契约 §3.1「服务端处理顺序」）：
 *   Zod 校验(40001) → 手机号校验(40002) → 10 分钟去重(40003) → 当日 5 单限流(40004)
 *   → 单号生成（主键冲突重试 ≤3 次）→ 落库 → 通知 → 写 notification_logs
 *   → 回写 notify_status → 返回
 *
 * 更新：状态流转矩阵校验（非法或 ⚠️ 需备注而未填 → 40006），回写 updated_at。
 */
import { createHash } from "node:crypto";
import type { Order } from "@prisma/client";

import { ErrorCode } from "@/lib/constants";
import {
  buildSerialId,
  etaText,
  
  isBusinessHours,
  serialIdLikePrefix,
  shanghaiDayRange,
} from "@/lib/format";
import { formatPrice } from "@/server/money";
import { ServiceError } from "@/lib/response";
import type { CreateOrderResult, OrderDTO, OrderPublicSummary, Page } from "@/lib/types";
import {
  orderCreateSchema,
  type OrderCreateData,
  type OrderListQuery,
  type OrderUpdateData,
} from "@/lib/validation";

import { prisma } from "./db";
import { sendAndLog } from "./notify";

// ─── 序列化（Prisma Order → DTO；数组/金额按契约口径） ────────────────────────

export function toOrderDTO(o: Order): OrderDTO {
  return {
    ...(o as unknown as OrderDTO),
    finalPrice: formatPrice(o.finalPrice) ?? null,
  };
}

// ─── 去重哈希（API 契约 §1.6：空值归一，null 与 '' 等同、null 与 [] 等同） ──────

/** 单字段归一：null/undefined/'' → ''；数组排序后 join（契约：otherTypes 排序后 join） */
function normalizeForHash(value: string | null | undefined | string[]): string {
  if (Array.isArray(value)) return [...value].sort().join(",");
  return value ?? "";
}

/**
 * dedupeKey = sha1(phone + serviceType + cleanTier + otherTypes排序后join
 *                + description + serviceMode + address)
 * 空值归一：null ≡ '' ≡ []（API 契约 §1.6，数据库契约 §5 I10）
 */
export function computeDedupeKey(input: {
  phone: string;
  serviceType: string;
  cleanTier: string | null;
  otherTypes: string[] | null;
  description: string | null;
  serviceMode: string;
  address: string | null;
}): string {
  const parts = [
    normalizeForHash(input.phone),
    normalizeForHash(input.serviceType),
    normalizeForHash(input.cleanTier),
    normalizeForHash(input.otherTypes ?? []),
    normalizeForHash(input.description),
    normalizeForHash(input.serviceMode),
    normalizeForHash(input.address),
  ];
  return createHash("sha1").update(parts.join("|")).digest("hex");
}

// ─── 创建订单 ─────────────────────────────────────────────────────────────────

/** Zod 校验失败 → 40001（字段级 issues 由 ServiceError.fields 透传给路由层） */
export function parseOrderCreateInput(raw: unknown): OrderCreateData {
  const result = orderCreateSchema.safeParse(raw);
  if (!result.success) {
    const fields = result.error.issues.map((i) => ({
      field: i.path.map(String).join(".") || "form",
      message: i.message,
    }));
    throw new ServiceError(ErrorCode.BAD_REQUEST, fields[0]?.message, fields);
  }
  return result.data;
}

/** 手机号校验（契约规定独立步骤：非 ^1[3-9]\d{9}$ → 40002，含字段定位） */
export function assertPhone(input: string): void {
  if (!/^1[3-9]\d{9}$/.test(input.trim())) {
    throw new ServiceError(ErrorCode.INVALID_PHONE, "请填写正确的 11 位手机号", [
      { field: "phone", message: "请填写正确的 11 位手机号" },
    ]);
  }
}

/**
 * 创建订单全链（契约 §3.1 / §8）。
 * @param raw 未校验请求体（路由层原样透传）
 * @param now 提交时刻（限流/单号/文案基准）
 */
export async function createOrder(
  raw: unknown,
  now: Date = new Date(),
): Promise<{ result: CreateOrderResult; order: OrderDTO }> {
  // 1. Zod 校验（40001）
  const data = parseOrderCreateInput(raw);

  // 2. 手机号（40002）
  assertPhone(data.phone);

  const { start: dayStart } = shanghaiDayRange(now);

  // 3. 10 分钟去重（40003）：同手机号窗口内订单逐条比对哈希（空值归一口径一致）
  const dedupeKey = computeDedupeKey({
    phone: data.phone,
    serviceType: data.serviceType,
    cleanTier: data.cleanTier ?? null,
    otherTypes: data.otherTypes ?? null,
    description: data.description ?? null,
    serviceMode: data.serviceMode,
    address: data.address ?? null,
  });
  const recent = await prisma.order.findMany({
    where: {
      phone: data.phone,
      createdAt: { gt: new Date(now.getTime() - 10 * 60 * 1000) },
    },
    select: {
      phone: true,
      serviceType: true,
      cleanTier: true,
      otherTypes: true,
      description: true,
      serviceMode: true,
      address: true,
    },
  });
  for (const row of recent) {
    if (computeDedupeKey(row) === dedupeKey) {
      throw new ServiceError(ErrorCode.DUPLICATED);
    }
  }

  // 4. 当日 5 单限流（40004，Asia/Shanghai 自然日）
  const todayCount = await prisma.order.count({
    where: { phone: data.phone, createdAt: { gte: dayStart } },
  });
  if (todayCount >= 5) {
    throw new ServiceError(ErrorCode.RATE_LIMITED);
  }

  // 5. 单号生成 + 落库（主键冲突重试 ≤3 次，契约 §7）
  const created = await insertWithRetry(data, now);

  // 6–8. 通知 + notification_logs + 回写 notify_status（失败不阻断，契约 §8）
  const dto = toOrderDTO(created);
  const outcome = await sendAndLog({ kind: "order", order: dto });
  const updated = await prisma.order.update({
    where: { id: created.id },
    data: { notifyStatus: outcome.status === "success" ? "success" : "failed" },
  });

  return {
    result: {
      orderId: updated.id,
      etaText: etaText(now),
      isBusinessHours: isBusinessHours(now),
      createdAt: updated.createdAt,
    },
    order: toOrderDTO(updated),
  };
}

/** 插入（冲突时流水 +1 重试，最多 3 次；契约 §7「捕获主键冲突后流水 +1 重试」） */
async function insertWithRetry(data: OrderCreateData, now: Date): Promise<Order> {
  const likePrefix = serialIdLikePrefix("R", now);
  const existing = await prisma.order.count({ where: { id: { startsWith: likePrefix } } });
  let seq = existing;

  for (let attempt = 0; attempt < 3; attempt++) {
    const id = buildSerialId("R", now, seq);
    try {
      return await prisma.order.create({
        data: {
          id,
          serviceType: data.serviceType,
          cleanTier: data.cleanTier,
          otherTypes: data.otherTypes ?? [],
          contactName: data.contactName,
          phone: data.phone,
          contactPref: data.contactPref,
          brandModel: data.brandModel,
          modelPhotos: data.modelPhotos ?? [],
          description: data.description ?? null,
          serviceMode: data.serviceMode,
          preferredTime: data.preferredTime ?? "尽快",
          address: data.serviceMode === "home" ? (data.address ?? null) : null,
          status: "pending", // 客户端不可指定状态（契约 §5）
        },
      });
    } catch (e) {
      const isPkConflict =
        e instanceof Error &&
        /P2002|unique constraint|duplicate key/i.test(e.message);
      if (isPkConflict) {
        seq += 1;
        continue;
      }
      throw e;
    }
  }
  throw new ServiceError(ErrorCode.INTERNAL);
}

// ─── 查询 ─────────────────────────────────────────────────────────────────────

/** 成功页脱敏摘要（契约 §3.4：不含 phone/contactName/address/description/照片/status） */
export async function getOrderPublicSummary(id: string): Promise<OrderPublicSummary> {
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) throw new ServiceError(ErrorCode.NOT_FOUND);
  return {
    orderId: order.id,
    serviceType: order.serviceType as OrderPublicSummary["serviceType"],
    cleanTier: order.cleanTier as OrderPublicSummary["cleanTier"],
    etaText: etaText(order.createdAt), // 以提交时刻判定（成功页刷新文案一致）
    createdAt: order.createdAt,
  };
}

/** 后台列表（契约 §4.4：筛选 + 分页 + createdAt DESC） */
export async function listOrders(query: OrderListQuery): Promise<Page<OrderDTO>> {
  const where: {
    status?: string;
    phone?: string;
    notifyStatus?: string;
    createdAt?: { gte?: Date; lte?: Date };
  } = {};
  if (query.status) where.status = query.status;
  if (query.phone) where.phone = query.phone;
  if (query.notifyStatus) where.notifyStatus = query.notifyStatus;
  if (query.from || query.to) {
    const createdAt: { gte?: Date; lte?: Date } = {};
    if (query.from) {
      createdAt.gte = shanghaiDayRange(new Date(`${query.from}T12:00:00Z`)).start;
    }
    if (query.to) {
      const { end } = shanghaiDayRange(new Date(`${query.to}T12:00:00Z`));
      createdAt.lte = new Date(end.getTime() - 1); // 含首尾
    }
    where.createdAt = createdAt;
  }

  const [total, rows] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.size,
      take: query.size,
    }),
  ]);
  return { page: query.page, size: query.size, total, items: rows.map(toOrderDTO) };
}

/** 后台详情（契约 §4.5：含关联售后） */
export async function getOrderDetail(id: string): Promise<OrderDTO & { aftersales: unknown[] }> {
  const order = await prisma.order.findUnique({ where: { id }, include: { aftersales: true } });
  if (!order) throw new ServiceError(ErrorCode.NOT_FOUND);
  const { aftersales, ...rest } = order;
  return { ...toOrderDTO(rest), aftersales };
}

// ─── 状态流转矩阵（数据库契约 §5，API 契约 §5） ────────────────────────────────

export type TransitionRule = "allowed" | "needs-remark" | "forbidden";

/**
 * 订单流转矩阵：行=当前状态，列=目标状态。
 * —（同状态）/未覆盖 → forbidden；「回退」类流转按 API 契约 §5 也必须备注。
 */
export const ORDER_TRANSITIONS: Record<string, Record<string, TransitionRule>> = {
  pending: { processing: "allowed", done: "needs-remark", aftersale: "allowed", closed: "allowed" },
  processing: { pending: "allowed", done: "allowed", aftersale: "allowed", closed: "allowed" },
  done: { pending: "allowed", processing: "allowed", aftersale: "allowed", closed: "allowed" },
  aftersale: { pending: "allowed", processing: "allowed", done: "allowed", closed: "allowed" },
  closed: { pending: "allowed", processing: "needs-remark", done: "needs-remark", aftersale: "allowed" },
};

/** 判定流转：同状态 → forbidden；矩阵未覆盖组合 → forbidden。 */
export function checkOrderTransition(from: string, to: string): TransitionRule {
  if (from === to) return "forbidden";
  return ORDER_TRANSITIONS[from]?.[to] ?? "forbidden";
}

/** 回退类流转（矩阵「回退」标注）：一律需备注（API 契约 §5：回退必须留痕） */
const BACKWARD_TARGETS: Record<string, Set<string>> = {
  processing: new Set(["pending"]),
  done: new Set(["pending", "processing"]),
  // 依据数据库契约 §5 矩阵：aftersale→processing / done 为普通 ✅（不要求备注），
  // 仅 aftersale→pending 属「回退」（需备注）。
  aftersale: new Set(["pending"]),
  closed: new Set(["pending"]),
};

export function isBackwardTransition(from: string, to: string): boolean {
  return BACKWARD_TARGETS[from]?.has(to) ?? false;
}

// ─── 后台更新（契约 §4.6） ────────────────────────────────────────────────────

export async function updateOrder(id: string, data: OrderUpdateData): Promise<OrderDTO> {
  const order = await prisma.order.findUnique({ where: { id } });
  if (!order) throw new ServiceError(ErrorCode.NOT_FOUND);

  const patch: {
    status?: string;
    remark?: string | null;
    finalPrice?: string | null;
    updatedAt: Date;
  } = { updatedAt: new Date() };

  if (data.finalPrice !== undefined) {
    patch.finalPrice = data.finalPrice; // Prisma 接受 "100.00" 字符串 → Decimal，禁浮点
  }
  if (data.remark !== null) {
    patch.remark = data.remark;
  }

  if (data.status !== undefined) {
    const rule = checkOrderTransition(order.status, data.status);
    if (rule === "forbidden") {
      throw new ServiceError(ErrorCode.ILLEGAL_TRANSITION);
    }
    // ⚠️ 需备注 或 回退 → 本次请求必须提交非空 remark（API 契约 §4.6/§5：
    // 「必须同时提交非空 remark」——严格口径：以提交值为准，已有备注不算）
    const needsRemark = rule === "needs-remark" || isBackwardTransition(order.status, data.status);
    if (needsRemark) {
      const submittedRemark = data.remark ?? "";
      if (submittedRemark.trim().length === 0) {
        throw new ServiceError(ErrorCode.ILLEGAL_TRANSITION, undefined, [
          { field: "remark", message: "该状态变更必须填写备注" },
        ]);
      }
    }
    patch.status = data.status;
  }

  const updated = await prisma.order.update({ where: { id }, data: patch });
  return toOrderDTO(updated);
}
