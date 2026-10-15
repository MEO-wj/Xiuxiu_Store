/**
 * 售后业务（API 契约 §3.2/§3.3/§4.7–§4.9；数据库契约 §3.2/§8）。
 *
 * - lookup：取最近一单 + 保修判定（与写入快照同一算法），仅返回脱敏摘要字段
 * - 创建：重匹配（防状态变化）+ in_warranty 快照 + 不修改 orders.status + 通知
 * - 列表/更新：状态机 pending → processing → closed，允许 processing → pending 回退
 */
import type { Aftersale, Order } from "@prisma/client";

import { ErrorCode } from "@/lib/constants";
import {
  aftersaleEtaText,
  buildSerialId,
  formatDateShanghai,
  isInWarranty,
  serialIdLikePrefix,
  warrantyEndDate,
} from "@/lib/format";
import { ServiceError } from "@/lib/response";
import type {
  AftersaleDTO,
  CreateAftersaleResult,
  LookupFound,
  LookupResult,
  OrderSummaryRef,
  Page,
} from "@/lib/types";
import {
  aftersaleCreateSchema,
  type AftersaleCreateData,
  type AftersaleListQuery,
  type AftersaleUpdateData,
} from "@/lib/validation";

import { prisma } from "./db";
import { sendAndLog } from "./notify";

type AftersaleWithOrder = Aftersale & { order: Order | null };

export function toAftersaleDTO(a: AftersaleWithOrder): AftersaleDTO {
  const orderSummary: OrderSummaryRef | null = a.order
    ? {
        id: a.order.id,
        serviceType: a.order.serviceType as OrderSummaryRef["serviceType"],
        cleanTier: a.order.cleanTier as OrderSummaryRef["cleanTier"],
        status: a.order.status as OrderSummaryRef["status"],
        createdAt: a.order.createdAt,
      }
    : null;
  return {
    ...(a as unknown as AftersaleDTO),
    order: orderSummary,
  };
}

/** 无关联查询结果 → DTO（order 置 null） */
export function toAftersaleDTOWithoutOrder(a: Aftersale): AftersaleDTO {
  return {
    ...(a as unknown as AftersaleDTO),
    order: null,
  };
}

// ─── 手机号校验（40002，与订单同口径） ─────────────────────────────────────────

export function assertAftersalePhone(input: string): void {
  if (!/^1[3-9]\d{9}$/.test(input.trim())) {
    throw new ServiceError(ErrorCode.INVALID_PHONE, "请填写正确的 11 位手机号", [
      { field: "phone", message: "请填写正确的 11 位手机号" },
    ]);
  }
}

// ─── lookup（契约 §3.3） ──────────────────────────────────────────────────────

/**
 * 售后订单自动匹配：取该手机号最近一笔订单（idx_orders_phone_created），
 * 保修判定用与写入快照同一算法（warrantyEndDate / isInWarranty，契约 I9 单一函数）。
 * 隐私：仅返回非敏感摘要，不返回联系人、地址、故障描述、照片。
 * 查不到订单不是错误（found:false，不阻止提交）。
 */
export async function lookupOrder(phone: string, now: Date = new Date()): Promise<LookupResult> {
  assertAftersalePhone(phone);
  const order = await prisma.order.findFirst({
    where: { phone: phone.trim() },
    orderBy: { createdAt: "desc" },
  });
  if (!order) return { found: false };

  const found: LookupFound = {
    found: true,
    orderId: order.id,
    serviceType: order.serviceType as LookupFound["serviceType"],
    cleanTier: order.cleanTier as LookupFound["cleanTier"],
    status: order.status as LookupFound["status"],
    orderDate: formatDateShanghai(order.createdAt),
    inWarranty: isInWarranty(order.createdAt, now),
    warrantyEndDate: warrantyEndDate(order.createdAt),
  };
  return found;
}

// ─── 创建售后（契约 §3.2 / §8） ──────────────────────────────────────────────

export function parseAftersaleCreateInput(raw: unknown): AftersaleCreateData {
  const result = aftersaleCreateSchema.safeParse(raw);
  if (!result.success) {
    const fields = result.error.issues.map((i) => ({
      field: i.path.map(String).join(".") || "form",
      message: i.message,
    }));
    throw new ServiceError(ErrorCode.BAD_REQUEST, fields[0]?.message, fields);
  }
  return result.data;
}

/**
 * 创建售后报修。
 * - 手机号校验（40002）→ 10 分钟同描述去重（40003）→ 重匹配订单（防状态变化）
 * - in_warranty 为写入时快照（isInWarranty 同一函数）
 * - 不修改 orders.status（契约 §3.2：由店主在后台手动置 aftersale）
 */
export async function createAftersale(
  raw: unknown,
  now: Date = new Date(),
): Promise<{ result: CreateAftersaleResult; aftersale: AftersaleDTO }> {
  const data = parseAftersaleCreateInput(raw);
  assertAftersalePhone(data.phone);

  // 10 分钟同手机号 + 同描述去重（契约 §1.6：POST /api/aftersales 规则）
  const since = new Date(now.getTime() - 10 * 60 * 1000);
  const duplicated = await prisma.aftersale.findFirst({
    where: { phone: data.phone, description: data.description, createdAt: { gt: since } },
  });
  if (duplicated) throw new ServiceError(ErrorCode.DUPLICATED);

  // 重匹配最近一单（只读；契约 §6.2 时序「再匹配一次（防状态变化）」）
  const matched = await prisma.order.findFirst({
    where: { phone: data.phone },
    orderBy: { createdAt: "desc" },
  });
  const inWarranty = matched ? isInWarranty(matched.createdAt, now) : false;

  const created = await insertWithRetry(data, matched?.id ?? null, inWarranty, now);

  // 通知（失败不阻断；含关联订单与保修快照）
  const outcome = await sendAndLog({
    kind: "aftersale",
    aftersaleId: created.id,
    phone: created.phone,
    description: created.description,
    order: matched
      ? {
          id: matched.id,
          serviceType: matched.serviceType as OrderSummaryRef["serviceType"],
          cleanTier: matched.cleanTier as OrderSummaryRef["cleanTier"],
          status: matched.status as OrderSummaryRef["status"],
          createdAt: matched.createdAt,
        }
      : null,
    inWarranty: created.inWarranty,
  });
  const updated = await prisma.aftersale.update({
    where: { id: created.id },
    data: { notifyStatus: outcome.status === "success" ? "success" : "failed" },
  });

  return {
    result: {
      aftersaleId: updated.id,
      matchedOrderId: updated.orderId,
      inWarranty: updated.inWarranty,
      etaText: aftersaleEtaText(),
    },
    aftersale: toAftersaleDTOWithoutOrder(updated),
  };
}

async function insertWithRetry(
  data: AftersaleCreateData,
  orderId: string | null,
  inWarranty: boolean,
  now: Date,
): Promise<Aftersale> {
  const likePrefix = serialIdLikePrefix("A", now);
  const existing = await prisma.aftersale.count({ where: { id: { startsWith: likePrefix } } });
  let seq = existing;

  for (let attempt = 0; attempt < 3; attempt++) {
    const id = buildSerialId("A", now, seq);
    try {
      return await prisma.aftersale.create({
        data: {
          id,
          phone: data.phone,
          orderId,
          inWarranty,
          description: data.description,
          media: data.media ?? [],
          status: "pending",
        },
      });
    } catch (e) {
      const isPkConflict =
        e instanceof Error && /P2002|unique constraint|duplicate key/i.test(e.message);
      if (isPkConflict) {
        seq += 1;
        continue;
      }
      throw e;
    }
  }
  throw new ServiceError(ErrorCode.INTERNAL);
}

// ─── 后台列表 / 详情（契约 §4.7/§4.8） ────────────────────────────────────────

export async function listAftersales(query: AftersaleListQuery): Promise<Page<AftersaleDTO>> {
  const where: { status?: string; phone?: string } = {};
  if (query.status) where.status = query.status;
  if (query.phone) where.phone = query.phone;

  const [total, rows] = await Promise.all([
    prisma.aftersale.count({ where }),
    prisma.aftersale.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: { order: true },
      skip: (query.page - 1) * query.size,
      take: query.size,
    }),
  ]);
  return { page: query.page, size: query.size, total, items: rows.map(toAftersaleDTO) };
}

export async function getAftersaleDetail(id: string): Promise<AftersaleDTO> {
  const row = await prisma.aftersale.findUnique({ where: { id }, include: { order: true } });
  if (!row) throw new ServiceError(ErrorCode.NOT_FOUND);
  return toAftersaleDTO(row);
}

// ─── 后台更新（契约 §4.9：pending → processing → closed，允许 processing → pending） ──

export type AftersaleTransition = "allowed" | "forbidden";

const AFTERSALE_TRANSITIONS: Record<string, Record<string, AftersaleTransition>> = {
  pending: { processing: "allowed" },
  processing: { pending: "allowed", closed: "allowed" },
  closed: {}, // 终态（契约未定义 closed → * 流转）
};

export function checkAftersaleTransition(from: string, to: string): AftersaleTransition {
  if (from === to) return "forbidden";
  return AFTERSALE_TRANSITIONS[from]?.[to] ?? "forbidden";
}

export async function updateAftersale(id: string, data: AftersaleUpdateData): Promise<AftersaleDTO> {
  const row = await prisma.aftersale.findUnique({ where: { id } });
  if (!row) throw new ServiceError(ErrorCode.NOT_FOUND);

  const patch: { status?: string; remark?: string | null; updatedAt: Date } = { updatedAt: new Date() };
  if (data.remark !== null) patch.remark = data.remark;

  if (data.status !== undefined) {
    if (checkAftersaleTransition(row.status, data.status) === "forbidden") {
      throw new ServiceError(ErrorCode.ILLEGAL_TRANSITION);
    }
    patch.status = data.status;
  }

  const updated = await prisma.aftersale.update({ where: { id }, data: patch });
  return toAftersaleDTOWithoutOrder(updated);
}
