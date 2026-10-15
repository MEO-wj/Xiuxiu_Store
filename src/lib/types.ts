/**
 * 领域类型：从 Prisma 生成类型派生，避免重复定义（契约 §2 字段口径 = Prisma 模型）。
 *
 * 注意（数据库契约 §13 末尾说明）：Prisma 不支持可选列表，otherTypes/modelPhotos/media
 * 在 Prisma 类型中是非可选 String[]，但数据库列可空、业务上用 null 表达「未上传」。
 * API 响应里这三类字段统一按 `string[] | null` 口径输出。
 */
import type { Prisma } from "@prisma/client";

import type {
  AftersaleStatus,
  CleanTier,
  ContactPref,
  NotifyStatus,
  OrderStatus,
  OtherType,
  ServiceMode,
  ServiceType,
} from "./constants";

// ─── Prisma 派生模型类型 ─────────────────────────────────────────────────────

export type OrderModel = Prisma.OrderGetPayload<{}>;
export type AftersaleModel = Prisma.AftersaleGetPayload<{ include: { order: true } }>;

/** 订单 JSON 形态（camelCase 直出；数组字段按可空口径，金额序列化为字符串） */
export type OrderDTO = Omit<OrderModel, "otherTypes" | "modelPhotos" | "finalPrice"> & {
  serviceType: ServiceType;
  cleanTier: CleanTier | null;
  otherTypes: OtherType[] | null;
  modelPhotos: string[] | null;
  finalPrice: string | null; // Decimal → "100.00"，API 契约 §1.2 金额为字符串
  status: OrderStatus;
  notifyStatus: NotifyStatus;
  contactPref: ContactPref;
  serviceMode: ServiceMode;
};

/** 售后关联订单摘要（契约 §2.3 order 字段） */
export type OrderSummaryRef = {
  id: string;
  serviceType: ServiceType;
  cleanTier: CleanTier | null;
  status: OrderStatus;
  createdAt: Date;
};

/** 售后 JSON 形态（含关联订单摘要，API 契约 §2.3） */
export type AftersaleDTO = Omit<AftersaleModel, "media" | "order" | "status" | "notifyStatus"> & {
  status: AftersaleStatus;
  notifyStatus: NotifyStatus;
  media: string[] | null;
  order: OrderSummaryRef | null;
};

// ─── API 响应包装（API 契约 §1.3） ───────────────────────────────────────────

/** 字段级错误定位（失败时 data 携带） */
export type FieldError = { field: string; message: string };

export type ApiErrorData = { field?: string; fields?: FieldError[] } | null;

export type ApiOk<T> = {
  code: 0;
  message: "ok";
  data: T;
};

export type ApiErr = {
  code: number; // 非 0，见 constants.ErrorCode
  message: string; // 可直接展示的中文文案
  data: ApiErrorData; // 字段级错误携带 field/fields，非字段级为 null
};

export type ApiResponse<T> = ApiOk<T> | ApiErr;

// ─── 分页（API 契约 §1.7 / §2.4） ────────────────────────────────────────────

export type Page<T> = {
  page: number;
  size: number;
  total: number;
  items: T[];
};

// ─── C 端接口数据结构 ────────────────────────────────────────────────────────

/** POST /api/orders 成功响应 data（契约 §3.1） */
export type CreateOrderResult = {
  orderId: string;
  etaText: string;
  isBusinessHours: boolean;
  createdAt: Date;
};

/** GET /api/orders/{id} 成功页脱敏摘要（契约 §3.4） */
export type OrderPublicSummary = {
  orderId: string;
  serviceType: ServiceType;
  cleanTier: CleanTier | null;
  etaText: string;
  createdAt: Date;
};

/** POST /api/aftersales 成功响应 data（契约 §3.2） */
export type CreateAftersaleResult = {
  aftersaleId: string;
  matchedOrderId: string | null;
  inWarranty: boolean;
  etaText: string;
};

/** GET /api/aftersales/lookup 响应 data（契约 §3.3） */
export type LookupFound = {
  found: true;
  orderId: string;
  serviceType: ServiceType;
  cleanTier: CleanTier | null;
  status: OrderStatus;
  /** 订单创建日（Asia/Shanghai，yyyy-MM-dd） */
  orderDate: string;
  inWarranty: boolean;
  /** 保修截止日 yyyy-MM-dd */
  warrantyEndDate: string;
};

export type LookupResult = LookupFound | { found: false };

/** POST /api/upload 成功响应 data（契约 §3.5） */
export type UploadResult = {
  url: string;
  size: number;
  width: number;
  height: number;
};

// ─── 后台接口数据结构 ────────────────────────────────────────────────────────

/** POST /api/admin/login / GET /api/admin/session 响应 data（契约 §4.1/§4.3） */
export type SessionInfo = {
  username: string;
  expiresAt: Date;
};

/** GET /api/admin/stats 响应 data（契约 §4.11） */
export type AdminStats = {
  todayOrders: number;
  weekDone: number;
  pendingCount: number;
  notifyFailedCount: number;
};
