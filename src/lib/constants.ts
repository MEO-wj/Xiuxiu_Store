/**
 * 全局常量：枚举 + 中文展示映射 + 错误码 + 文案
 *
 * 唯一口径：
 *  - API 契约 §1.4（错误码）/ §2（枚举）/ §7（提示文案）
 *  - 数据库契约 §4（值域字典）/ §5（不变量）/ §7（单号）
 *  - PRD §5.2.4（表单与价格）/ §6.1（通知模板）/ §7.1（上门规则）/ §7.4（保修）
 *
 * 阈值/窗口类常量必须集中在此文件，禁止散落硬编码（开发文档 §2.3）。
 */

// ─── 枚举（应用层字符串，数据库不用 ENUM，契约 §4） ───────────────────────────

export const SERVICE_TYPES = ["clean", "other"] as const;
export type ServiceType = (typeof SERVICE_TYPES)[number];

export const CLEAN_TIERS = ["basic80", "deep100"] as const;
export type CleanTier = (typeof CLEAN_TIERS)[number];

export const OTHER_TYPES = ["screen", "wifi", "slow", "other"] as const;
export type OtherType = (typeof OTHER_TYPES)[number];

export const CONTACT_PREFS = ["phone", "wechat"] as const;
export type ContactPref = (typeof CONTACT_PREFS)[number];

export const SERVICE_MODES = ["shop", "home"] as const;
export type ServiceMode = (typeof SERVICE_MODES)[number];

export const ORDER_STATUSES = ["pending", "processing", "done", "aftersale", "closed"] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const AFTERSALE_STATUSES = ["pending", "processing", "closed"] as const;
export type AftersaleStatus = (typeof AFTERSALE_STATUSES)[number];

export const NOTIFY_STATUSES = ["pending", "success", "failed"] as const;
export type NotifyStatus = (typeof NOTIFY_STATUSES)[number];

/** 通知通道（数据库契约 §4 channel 值域） */
export const NOTIFY_CHANNELS = ["console", "wecom", "serverchan"] as const;
export type NotifyChannel = (typeof NOTIFY_CHANNELS)[number];

// ─── 枚举中文展示映射（API 契约 §2.1） ────────────────────────────────────────

export const SERVICE_TYPE_LABELS: Record<ServiceType, string> = {
  clean: "清灰换硅脂",
  other: "其他问题",
};

export const CLEAN_TIER_LABELS: Record<CleanTier, string> = {
  basic80: "标准清灰换硅脂 ¥80",
  deep100: "深度清洁 ¥100",
};

export const OTHER_TYPE_LABELS: Record<OtherType, string> = {
  screen: "屏幕故障",
  wifi: "网络问题",
  slow: "系统卡顿",
  other: "其他",
};

export const CONTACT_PREF_LABELS: Record<ContactPref, string> = {
  phone: "电话联系",
  wechat: "微信联系",
};

export const SERVICE_MODE_LABELS: Record<ServiceMode, string> = {
  shop: "到店送修",
  home: "上门服务",
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: "待处理",
  processing: "进行中",
  done: "已完成",
  aftersale: "售后",
  closed: "已关闭",
};

export const AFTERSALE_STATUS_LABELS: Record<AftersaleStatus, string> = {
  pending: "待处理",
  processing: "处理中",
  closed: "已关闭",
};

export const NOTIFY_STATUS_LABELS: Record<NotifyStatus, string> = {
  pending: "未发送",
  success: "已通知",
  failed: "通知失败",
};

// ─── 错误码（API 契约 §1.4，禁止自创） ────────────────────────────────────────

export const ErrorCode = {
  OK: 0,
  BAD_REQUEST: 40001, // Zod 校验失败（含未知字段、条件字段违规）
  INVALID_PHONE: 40002, // 手机号格式错误（含座机）
  DUPLICATED: 40003, // 同手机号 + 同内容 10 分钟内重复提交
  RATE_LIMITED: 40004, // 同手机号当日超过 5 单
  UPLOAD_INVALID: 40005, // 上传类型/大小不合法或触发同 IP 限流
  ILLEGAL_TRANSITION: 40006, // 非法状态流转，或需备注而未填
  UNAUTHORIZED: 40100, // 后台未登录 / 会话失效
  NOT_FOUND: 40400, // 按单号查询不存在
  INTERNAL: 50000, // 服务端异常
} as const;

export type ErrorCodeValue = (typeof ErrorCode)[keyof typeof ErrorCode];

/** 错误码 → HTTP 状态码（API 契约 §1.4） */
export const ERROR_HTTP_STATUS: Record<number, number> = {
  [ErrorCode.OK]: 200,
  [ErrorCode.BAD_REQUEST]: 400,
  [ErrorCode.INVALID_PHONE]: 400,
  [ErrorCode.DUPLICATED]: 409,
  [ErrorCode.RATE_LIMITED]: 429,
  [ErrorCode.UPLOAD_INVALID]: 400,
  [ErrorCode.ILLEGAL_TRANSITION]: 400,
  [ErrorCode.UNAUTHORIZED]: 401,
  [ErrorCode.NOT_FOUND]: 404,
  [ErrorCode.INTERNAL]: 500,
};

/**
 * 错误码 → 默认中文文案（与契约 §1.4 / §7.1 一字不差）。
 * 字段级文案（40001/40002 场景下被 Zod message 覆盖）见 validation.ts。
 */
export const ERROR_MESSAGES: Record<number, string> = {
  [ErrorCode.OK]: "ok",
  [ErrorCode.BAD_REQUEST]: "请检查填写内容",
  [ErrorCode.INVALID_PHONE]: "请填写正确的 11 位手机号",
  [ErrorCode.DUPLICATED]: "您刚刚已提交过相同的订单",
  [ErrorCode.RATE_LIMITED]: "提交过于频繁，请直接电话 18029516310 或加官方微信",
  [ErrorCode.UPLOAD_INVALID]: "图片格式或大小不符合要求",
  [ErrorCode.ILLEGAL_TRANSITION]: "当前状态不允许此操作",
  [ErrorCode.UNAUTHORIZED]: "登录已过期，请重新登录",
  [ErrorCode.NOT_FOUND]: "未找到该记录",
  [ErrorCode.INTERNAL]: "提交失败，请重试或直接拨打 18029516310",
};

// ─── 服务价格与套餐文案（PRD §5.2.4，金额用字符串避免浮点） ────────────────────

/** 标准清灰换硅脂：¥80（禁浮点，统一字符串口径） */
export const PRICE_BASIC = "80.00";
/** 深度清洁：¥100 */
export const PRICE_DEEP = "100.00";

export const CLEAN_TIER_DESCRIPTIONS: Record<CleanTier, string> = {
  basic80: "拆机除尘、更换硅脂、散热测试 · 含 7 天保修",
  deep100: "在 ¥80 服务基础上，使用 530 精密清洁剂清洗风扇、散热模组等 · 含 7 天保修",
};

/** 通知模板里的套餐展示（PRD §6.1 类型行「清灰换硅脂 · 深度清洁 ¥100（含 7 天保修）」） */
export const CLEAN_TIER_SHORT_LABELS: Record<CleanTier, string> = {
  basic80: "标准 ¥80",
  deep100: "深度清洁 ¥100",
};

/** 「其他问题」价格说明（PRD §5.2.4 固定展示） */
export const OTHER_PRICE_NOTICE = "免费检测 · 报价确认后再维修 · 未确认不收费";

// ─── 上门服务规则文案（PRD §7.1 原文，已定稿直接使用） ────────────────────────

export const HOME_SERVICE_NOTICE = [
  "⚠️ 上门需师傅排期，具体时间以沟通确认为准。",
  "费用：桑浦山校区 10 公里内不加价；超出加收 10–20 元；东海岸校区因交通不便，请电话或微信商量。",
  "上门检查后不维修，不收费。急用建议到店。",
].join("\n");

/** 无法上门时的委婉表述（PRD §7.1 第 4 条） */
export const HOME_SERVICE_FALLBACK = "如无法上门，我们会联系您说明并建议到店送修。";

// ─── 售后保修说明（PRD §5.3 页面顶部 / §7.4） ────────────────────────────────

export const WARRANTY_NOTICE =
  "清灰换硅脂享 7 天保修：7 天内出现与清灰相关的问题（如温度仍高、风扇异响），免费返修；超出保修期或其他问题，我们先检测再报价。";

/** 保修期总天数（自然日，含交付当天；截止日 = 交付日 + 6 天） */
export const WARRANTY_DAYS = 7;

// ─── 营业时间（Asia/Shanghai 9:00–17:00，API 契约 §3.1 / PRD §5.4） ───────────

export const TIMEZONE = "Asia/Shanghai";
export const BUSINESS_HOURS_START = 9; // 09:00（含）
export const BUSINESS_HOURS_END = 17; // 17:00（不含，即 9:00–17:00 区间）

/** 联系时效文案：营业时间内（PRD §5.2.4 联系时效承诺） */
export const ETA_TEXT_BUSINESS_HOURS = "我们会在 30 分钟内按您选的方式（电话 / 微信）联系您";
/** 联系时效文案：非营业时间 */
export const ETA_TEXT_OFF_HOURS = "我们会在次日 9:00 后尽快联系您";
/** 售后提交成功文案（PRD §5.3） */
export const ETA_TEXT_AFTERSALE = "已收到，我们会尽快联系您核对";

// ─── 防重 / 限流 / 会话阈值（API 契约 §1.5/§1.6；集中定义，禁止散落） ──────────

/** 同手机号 + 同内容去重窗口（毫秒）：10 分钟 */
export const DEDUP_WINDOW_MS = 10 * 60 * 1000;
/** 同手机号当日（Asia/Shanghai 自然日）最大订单数 */
export const DAILY_ORDER_LIMIT = 5;
/** 同 IP 上传限流默认值（每小时），由 UPLOAD_RATE_LIMIT_PER_HOUR 覆盖 */
export const UPLOAD_RATE_LIMIT_DEFAULT = 30;
/** 登录失败锁定：次数阈值与锁定时长（API 契约 §1.5） */
export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_LOCK_MS = 10 * 60 * 1000;
/** 会话有效期：8 小时（API 契约 §1.5 Cookie Max-Age=28800） */
export const SESSION_TTL_MS = 8 * 60 * 60 * 1000;
/** 会话 Cookie 名 */
export const SESSION_COOKIE = "xiuxiu_session";

// ─── 校验规则常量（与 validation.ts 共用口径） ───────────────────────────────

/** 手机号（拒座机）：^1[3-9]\d{9}$（PRD A3 / 契约 I3） */
export const PHONE_REGEX = /^1[3-9]\d{9}$/;
/** 期望时间指定格式：yyyy-MM-dd HH:mm */
export const PREFERRED_TIME_DATETIME_REGEX = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/;
/** 上传照片 URL 前缀白名单（防外部 URL 注入，契约 I5） */
export const UPLOAD_URL_PREFIX = "/uploads/";
/** 照片数量上限（契约 I5） */
export const MAX_PHOTOS = 3;
/** 单张上传大小上限：5MB（API 契约 §1.8） */
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

// ─── 店铺信息 ────────────────────────────────────────────────────────────────

export const SHOP_NAME = "xiu xiu";
export const SHOP_PHONE = "18029516310";
