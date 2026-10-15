/**
 * Zod schema：前端与接口共用（开发文档 §5.1）。
 *
 * 规则唯一口径：API 契约 §3（请求字段与校验）+ §1.2（未知字段 40001，strict）+
 * 数据库契约 §5（不变量 I1–I11）+ PRD §5.2.4/§5.3（字段表与提示文案）。
 *
 * 错误 message 使用 PRD 指定文案（API 契约 §7.1 登记），前端原样展示。
 */
import { z } from "zod";

import {
  AFTERSALE_STATUSES,
  CLEAN_TIERS,
  CONTACT_PREFS,
  MAX_PHOTOS,
  NOTIFY_STATUSES,
  ORDER_STATUSES,
  OTHER_TYPES,
  PHONE_REGEX,
  PREFERRED_TIME_DATETIME_REGEX,
  SERVICE_MODES,
  SERVICE_TYPES,
  UPLOAD_URL_PREFIX,
} from "./constants";

// ─── 基础构件 ────────────────────────────────────────────────────────────────

/**
 * 手机号字段：Zod 层只校验「是字符串」，格式校验统一由 service 层 assertPhone
 * 抛 40002（API 契约 §1.4：手机号格式错误 → 40002，而非 40001；
 * 冒烟用例 §8.1 #3「座机号 → 期望 code=40002」）。非字符串类型仍 40001。
 */
const phoneSchema = z.string({ message: "请填写正确的 11 位手机号" }).trim().min(1, "请填写正确的 11 位手机号").max(11, "请填写正确的 11 位手机号");

/** 照片/媒体数组：≤3 且元素以 /uploads/ 开头（契约 I5） */
const uploadsSchema = z
  .array(z.string().startsWith(UPLOAD_URL_PREFIX, "图片地址必须以 /uploads/ 开头"))
  .max(MAX_PHOTOS, `最多上传 ${MAX_PHOTOS} 张图片`);

/** 期望时间：枚举或 yyyy-MM-dd HH:mm（PRD A9） */
/** yyyy-MM-dd HH:mm 的语义校验（正则通过后再校验月/日/时/分范围与真实日期） */
function isSemanticDateTime(v: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2}) (\d{2}):(\d{2})$/.exec(v);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  const h = Number(m[4]);
  const mi = Number(m[5]);
  if (mo < 1 || mo > 12 || d < 1 || d > 31 || h > 23 || mi > 59) return false;
  const date = new Date(Date.UTC(y, mo - 1, d, h, mi));
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d;
}

const preferredTimeSchema = z
  .string()
  .trim()
  .refine(
    (v) =>
      v === "尽快" ||
      v === "今天" ||
      v === "明天" ||
      (PREFERRED_TIME_DATETIME_REGEX.test(v) && isSemanticDateTime(v)),
    "请选择正确的期望时间",
  );

// ─── 订单创建（POST /api/orders，契约 §3.1） ─────────────────────────────────

/**
 * 订单创建 schema（strict：未知字段（含 status/notifyStatus/finalPrice/remark）直接 40001，
 * 契约 §5「客户端提交订单时不接受这些字段」）。
 */
export const orderCreateSchema = z
  .object({
    serviceType: z.enum(SERVICE_TYPES, { message: "请选择服务类型" }),
    /** clean 时必填；other 时可省略（省略视为 null），若提供必须为 null（契约 §3.1） */
    cleanTier: z
      .enum(CLEAN_TIERS, { message: "请选择清灰套餐" })
      .nullish()
      .transform((v) => v ?? null),
    /** other 时长度 ≥1；clean 时可省略（省略视为 null），若提供必须为 null */
    otherTypes: z
      .array(z.enum(OTHER_TYPES, { message: "问题类型不正确" }))
      .nullish()
      .transform((v) => v ?? null),
    contactName: z
      .string({ message: "请填写联系人姓名" })
      .trim()
      .min(1, "请填写联系人姓名")
      .max(20, "联系人姓名不能超过 20 字"),
    phone: phoneSchema,
    contactPref: z.enum(CONTACT_PREFS, { message: "请选择联系偏好" }),
    brandModel: z
      .string({ message: "请填写电脑品牌 / 型号" })
      .trim()
      .min(1, "请填写电脑品牌 / 型号")
      .max(50, "电脑品牌 / 型号不能超过 50 字"),
    modelPhotos: uploadsSchema.nullish().transform((v) => v ?? null),
    description: z
      .string()
      .trim()
      .max(300, "描述不能超过 300 字")
      .nullish()
      .transform((v) => (v === null || v === "" ? null : v)),
    serviceMode: z.enum(SERVICE_MODES, { message: "请选择服务方式" }),
    preferredTime: preferredTimeSchema
      .nullish()
      .transform((v) => (v === null || v === "" ? null : v)),
    /** 仅 home 允许非空；'' 归一为 null（契约 §1.2 / I4） */
    address: z
      .string()
      .trim()
      .max(100, "地址不能超过 100 字")
      .nullish()
      .transform((v) => (v === null || v === "" ? null : v)),
  })
  .strict()
  .superRefine((data, ctx) => {
    // I1/I2：两类服务字段互斥（省略视为 null）
    if (data.serviceType === "clean") {
      if (data.cleanTier == null) {
        ctx.addIssue({ code: "custom", path: ["cleanTier"], message: "请选择清灰套餐" });
      }
      if (data.otherTypes != null) {
        ctx.addIssue({ code: "custom", path: ["otherTypes"], message: "清灰换硅脂不需要选择问题类型" });
      }
    } else {
      if (data.otherTypes == null || data.otherTypes.length < 1) {
        ctx.addIssue({ code: "custom", path: ["otherTypes"], message: "请至少选择一个问题类型" });
      }
      if (data.cleanTier != null) {
        ctx.addIssue({ code: "custom", path: ["cleanTier"], message: "其他问题无需选择清灰套餐" });
      }
    }
    // B2：otherTypes 含 other 时 description 必填
    if (data.serviceType === "other" && data.otherTypes?.includes("other") === true && !data.description) {
      ctx.addIssue({ code: "custom", path: ["description"], message: "请描述一下具体问题" });
    }
    // I4：shop 时 address 必须为空（home 允许非空也允许留空，PRD §7.1 地址选填）
    if (data.serviceMode === "shop" && data.address != null) {
      ctx.addIssue({ code: "custom", path: ["address"], message: "到店送修无需填写上门地址" });
    }
  });

export type OrderCreateInput = z.input<typeof orderCreateSchema>;
export type OrderCreateData = z.output<typeof orderCreateSchema>;

// ─── 售后创建（POST /api/aftersales，契约 §3.2） ──────────────────────────────

export const aftersaleCreateSchema = z
  .object({
    phone: phoneSchema,
    description: z
      .string({ message: "请描述一下具体问题" })
      .trim()
      .min(1, "请描述一下具体问题")
      .max(300, "描述不能超过 300 字"),
    media: uploadsSchema.nullish().transform((v) => v ?? null),
  })
  .strict();

export type AftersaleCreateInput = z.input<typeof aftersaleCreateSchema>;
export type AftersaleCreateData = z.output<typeof aftersaleCreateSchema>;

// ─── lookup 参数（GET /api/aftersales/lookup?phone=…，契约 §3.3） ─────────────

export const lookupQuerySchema = z
  .object({
    phone: z.string().trim().min(1, "请填写正确的 11 位手机号"),
  })
  .strict();

export type LookupQuery = z.output<typeof lookupQuerySchema>;

// ─── 后台登录（POST /api/admin/login，契约 §4.1） ─────────────────────────────

export const adminLoginSchema = z
  .object({
    username: z.string({ message: "请输入账号" }).trim().min(1, "请输入账号").max(32, "账号不正确"),
    password: z.string({ message: "请输入密码" }).min(1, "请输入密码").max(128, "密码不正确"),
  })
  .strict();

export type AdminLoginInput = z.input<typeof adminLoginSchema>;
export type AdminLoginData = z.output<typeof adminLoginSchema>;

// ─── 后台订单更新（PATCH /api/admin/orders/{id}，契约 §4.6） ──────────────────

/** 金额字符串："80.00" 形式，∈ [0, 999999.99]（契约 §4.6 / I6）；整数分比较，禁浮点 */
export const finalPriceSchema = z
  .string({ message: "请填写正确的金额" })
  .regex(/^\d{1,7}(\.\d{1,2})?$/, "请填写正确的金额（最多两位小数）")
  .refine((v) => {
    const parts = v.split(".");
    const intPart = parts[0] ?? "0";
    const decPart = parts[1] ?? "";
    const cents = Number.parseInt(intPart, 10) * 100 + Number.parseInt(decPart.padEnd(2, "0"), 10);
    return Number.isFinite(cents) && cents >= 0 && cents <= 99999999;
  }, "金额超出范围（0 – 999999.99）")
  .nullable();

export const orderUpdateSchema = z
  .object({
    status: z.enum(ORDER_STATUSES, { message: "状态不正确" }).optional(),
    remark: z.string().trim().max(500, "备注不能超过 500 字").nullish().transform((v) => v ?? null),
    finalPrice: finalPriceSchema.optional(),
  })
  .strict()
  .refine((data) => data.status !== undefined || data.remark !== null || data.finalPrice !== undefined, {
    message: "请至少修改一项内容",
  });

export type OrderUpdateInput = z.input<typeof orderUpdateSchema>;
export type OrderUpdateData = z.output<typeof orderUpdateSchema>;

// ─── 后台售后更新（PATCH /api/admin/aftersales/{id}，契约 §4.9） ──────────────

export const aftersaleUpdateSchema = z
  .object({
    status: z.enum(AFTERSALE_STATUSES, { message: "状态不正确" }).optional(),
    remark: z.string().trim().max(500, "备注不能超过 500 字").nullish().transform((v) => v ?? null),
  })
  .strict()
  .refine((data) => data.status !== undefined || data.remark !== null, {
    message: "请至少修改一项内容",
  });

export type AftersaleUpdateInput = z.input<typeof aftersaleUpdateSchema>;
export type AftersaleUpdateData = z.output<typeof aftersaleUpdateSchema>;

// ─── 后台列表查询参数（契约 §4.4/§4.7/§4.10） ────────────────────────────────

const dateString = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "日期格式应为 yyyy-MM-dd");

export const orderListQuerySchema = z
  .object({
    status: z.enum(ORDER_STATUSES).optional(),
    phone: phoneSchema.optional(),
    notifyStatus: z.enum(NOTIFY_STATUSES).optional(),
    from: dateString.optional(),
    to: dateString.optional(),
    page: z.coerce.number().int().min(1).default(1),
    size: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export type OrderListQuery = z.output<typeof orderListQuerySchema>;

export const aftersaleListQuerySchema = z
  .object({
    status: z.enum(AFTERSALE_STATUSES).optional(),
    phone: phoneSchema.optional(),
    page: z.coerce.number().int().min(1).default(1),
    size: z.coerce.number().int().min(1).max(100).default(20),
  })
  .strict();

export type AftersaleListQuery = z.output<typeof aftersaleListQuerySchema>;

export const exportQuerySchema = z
  .object({
    type: z.enum(["orders", "aftersales"], { message: "导出类型不正确" }),
    status: z.enum(ORDER_STATUSES).optional(),
    from: dateString.optional(),
    to: dateString.optional(),
  })
  .strict();

export type ExportQuery = z.output<typeof exportQuerySchema>;

// ─── 上传（POST /api/upload 的文件元信息校验；契约 §1.8/§3.5） ───────────────

export const UPLOAD_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/heic"] as const;

export const uploadMetaSchema = z.object({
  /** multipart 字段名必须为 file（契约 §1.8） */
  field: z.literal("file"),
  contentType: z.enum(UPLOAD_MIME_TYPES),
  size: z.number().int().positive().max(5 * 1024 * 1024, "图片格式或大小不符合要求"),
});

/** 判断手机号是否合法（service 层 40002 判定用，独立函数便于复用） */
export function isValidPhone(value: string): boolean {
  return PHONE_REGEX.test(value.trim());
}
