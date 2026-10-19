/**
 * T5 核心库验证脚本（直接调用 lib/server 纯函数与真实 DB，不依赖 HTTP）。
 *
 * 覆盖（任务要求逐项）：
 *   1. 单号生成与解析（含 >999 扩 4 位）
 *   2. 去重哈希空值归一（null vs ''、null vs []）
 *   3. 保修边界（交付日、+6 天、+7 天）
 *   4. 营业时间文案切换
 *   5. 状态流转矩阵（含 ⚠️ 需备注 → 40006）
 *   6. 手机号与条件字段校验（clean/other 互斥）
 *   7. CSV 转义
 *   8. 真实 DB：createOrder 落库 + notification_logs + notify_status（独立手机号，测试后清理）
 *
 * 运行：pnpm exec tsx scripts/verify-core.ts
 */
import { PrismaClient } from "@prisma/client";

import { ErrorCode, ORDER_STATUSES } from "../src/lib/constants";
import {
  buildSerialId,
  etaText,
  isBusinessHours,
  isInWarranty,
  parseSerialId,
  shanghaiDayRange,
  warrantyEndDate,
} from "../src/lib/format";
import { fail, failWithField, ok } from "../src/lib/response";
import { aftersaleCreateSchema, orderCreateSchema } from "../src/lib/validation";
import {
  checkAftersaleTransition,
  createAftersale,
  lookupOrder,
} from "../src/server/aftersale-service";
import { csvEscape, csvRow } from "../src/server/export";
import {
  checkOrderTransition,
  computeDedupeKey,
  createOrder,
  updateOrder,
} from "../src/server/order-service";

let passed = 0;
let failed = 0;

function check(name: string, condition: boolean, detail?: string): void {
  if (condition) {
    passed += 1;
    console.log(`  PASS  ${name}`);
  } else {
    failed += 1;
    console.error(`  FAIL  ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function section(title: string): void {
  console.log(`\n=== ${title} ===`);
}

// ─── 1. 单号生成与解析 ────────────────────────────────────────────────────────

section("1. 单号生成与解析");

// 2026-10-05 14:30 Shanghai = 06:30 UTC
const d = new Date("2026-10-05T06:30:00.000Z");
check("buildSerialId 001", buildSerialId("R", d, 0) === "R20261005-001", buildSerialId("R", d, 0));
check("buildSerialId 099", buildSerialId("A", d, 98) === "A20261005-099");
check("buildSerialId 999", buildSerialId("R", d, 998) === "R20261005-999");
check(">999 扩 4 位", buildSerialId("R", d, 999) === "R20261005-1000", buildSerialId("R", d, 999));
check(">9999 自然扩位", buildSerialId("A", d, 9999) === "A20261005-10000");

const parsed = parseSerialId("R20261005-001");
check(
  "parseSerialId 往返",
  parsed !== null && parsed.prefix === "R" && parsed.dateKey === "20261005" && parsed.serial === 1,
  JSON.stringify(parsed),
);
const parsed4 = parseSerialId("A20261231-1234");
check("parseSerialId 4 位流水", parsed4 !== null && parsed4.serial === 1234);
check("parseSerialId 非法日期(13月)", parseSerialId("R20261301-001") === null);
check("parseSerialId 非法前缀", parseSerialId("X20261005-001") === null);
check("parseSerialId 位数不足", parseSerialId("R20261005-01") === null);

// 跨日边界：UTC 16:00（Shanghai 次日 00:00）应归次日
const edge = new Date("2026-10-05T16:00:00.000Z");
check("UTC 16:00 = Shanghai 10-06", buildSerialId("R", edge, 0) === "R20261006-001", buildSerialId("R", edge, 0));

// ─── 2. 去重哈希空值归一 ──────────────────────────────────────────────────────

section("2. 去重哈希空值归一（null ≡ '' ≡ []）");

const hashBase = {
  phone: "13800000000",
  serviceType: "other",
  cleanTier: null as string | null,
  otherTypes: null as string[] | null,
  description: null as string | null,
  serviceMode: "shop",
  address: null as string | null,
};
const h0 = computeDedupeKey(hashBase);
check("null vs ''（description/address）", computeDedupeKey({ ...hashBase, description: "", address: "" }) === h0);
check("null vs []（otherTypes）", computeDedupeKey({ ...hashBase, otherTypes: [] }) === h0);
check("全空值组合等价", computeDedupeKey({ ...hashBase, otherTypes: [], description: "", address: "" }) === h0);
check(
  "otherTypes 顺序无关（排序后 join）",
  computeDedupeKey({ ...hashBase, otherTypes: ["wifi", "screen"] }) ===
    computeDedupeKey({ ...hashBase, otherTypes: ["screen", "wifi"] }),
);
check("内容不同 → 哈希不同", computeDedupeKey({ ...hashBase, description: "风扇响" }) !== h0);
check("cleanTier null vs '' 等价", computeDedupeKey({ ...hashBase, cleanTier: "" }) === h0);

// ─── 3. 保修边界 ──────────────────────────────────────────────────────────────

section("3. 保修边界（交付日=第1天，截止=交付日+6天，共7自然日）");

// 交付日 2026-10-01（Shanghai）；截止 = 10-07；10-08 起超保
const delivered = new Date("2026-09-30T18:00:00.000Z"); // Shanghai 10-01 02:00
check("截止日 = 交付日 + 6 天", warrantyEndDate(delivered) === "2026-10-07", warrantyEndDate(delivered));
check("交付日当天在保", isInWarranty(delivered, new Date("2026-09-30T16:00:00.000Z")) === true); // Shanghai 10-01 00:00
check("+6 天（10-07）在保", isInWarranty(delivered, new Date("2026-10-06T16:00:00.000Z")) === true); // 10-07 00:00
check("+7 天（10-08）超保", isInWarranty(delivered, new Date("2026-10-07T16:00:00.000Z")) === false); // 10-08 00:00
check("截止日当天最后一刻在保", isInWarranty(delivered, new Date("2026-10-07T15:59:59.999Z")) === true);
check("交付次日在保", isInWarranty(delivered, new Date("2026-10-01T16:00:00.000Z")) === true);
// 契约示例口径：R20260928 交付 → 截止 10-04
check(
  "契约示例：09-28 交付 → 截止 10-04",
  warrantyEndDate(new Date("2026-09-28T02:00:00.000Z")) === "2026-10-04",
  warrantyEndDate(new Date("2026-09-28T02:00:00.000Z")),
);

// ─── 4. 营业时间判定与文案切换 ────────────────────────────────────────────────

section("4. 营业时间（9:00–17:00 Asia/Shanghai）与文案");

// 09:00 Shanghai = 01:00 UTC；17:00 Shanghai = 09:00 UTC
check("09:00 整营业中", isBusinessHours(new Date("2026-10-05T01:00:00.000Z")) === true);
check("16:59 营业中", isBusinessHours(new Date("2026-10-05T08:59:00.000Z")) === true);
check("17:00 整已下班", isBusinessHours(new Date("2026-10-05T09:00:00.000Z")) === false);
check("08:59 未营业", isBusinessHours(new Date("2026-10-05T00:59:00.000Z")) === false);
check(
  "营业中文案（30 分钟承诺）",
  etaText(new Date("2026-10-05T01:00:00.000Z")) === "我们会在 30 分钟内按您选的方式（电话 / 微信）联系您",
);
check(
  "非营业时间文案（次日 9:00）",
  etaText(new Date("2026-10-05T09:00:00.000Z")) === "我们会在次日 9:00 后尽快联系您",
);
check("UTC 16:00 属 Shanghai 次日 00:00（非营业）", isBusinessHours(new Date("2026-10-05T16:00:00.000Z")) === false);
const range = shanghaiDayRange(new Date("2026-10-05T16:30:00.000Z"));
check(
  "Shanghai 自然日范围（UTC+8）",
  range.start.toISOString() === "2026-10-05T16:00:00.000Z" && range.end.toISOString() === "2026-10-06T16:00:00.000Z",
  `${range.start.toISOString()} ~ ${range.end.toISOString()}`,
);

// ─── 5. 订单状态流转矩阵 ──────────────────────────────────────────────────────

section("5. 状态流转矩阵（✅ / ⚠️ / 非法）");

// 矩阵逐格断言（数据库契约 §5 表）
const MATRIX: Record<string, Record<string, string>> = {
  pending: { processing: "allowed", done: "needs-remark", aftersale: "allowed", closed: "allowed" },
  processing: { pending: "allowed", done: "allowed", aftersale: "allowed", closed: "allowed" },
  done: { pending: "allowed", processing: "allowed", aftersale: "allowed", closed: "allowed" },
  aftersale: { pending: "allowed", processing: "allowed", done: "allowed", closed: "allowed" },
  closed: { pending: "allowed", processing: "needs-remark", done: "needs-remark", aftersale: "allowed" },
};
let matrixOk = true;
for (const from of ORDER_STATUSES) {
  for (const to of ORDER_STATUSES) {
    const expected = from === to ? "forbidden" : (MATRIX[from]?.[to] ?? "forbidden");
    const actual = checkOrderTransition(from, to);
    if (actual !== expected) {
      matrixOk = false;
      console.error(`    矩阵不符：${from}→${to} 期望 ${expected} 实际 ${actual}`);
    }
  }
}
check("矩阵 25 格全对", matrixOk);
check("同状态 forbidden", checkOrderTransition("pending", "pending") === "forbidden");
check("pending→done 需备注(⚠️)", checkOrderTransition("pending", "done") === "needs-remark");
check("closed→done 需备注(⚠️)", checkOrderTransition("closed", "done") === "needs-remark");

check("售后 pending→processing", checkAftersaleTransition("pending", "processing") === "allowed");
check("售后 processing→pending 回退", checkAftersaleTransition("processing", "pending") === "allowed");
check("售后 processing→closed", checkAftersaleTransition("processing", "closed") === "allowed");
check("售后 pending→closed 跳态禁止", checkAftersaleTransition("pending", "closed") === "forbidden");
check("售后 closed→* 终态禁止", checkAftersaleTransition("closed", "processing") === "forbidden");

// ─── 6. Zod 校验 ──────────────────────────────────────────────────────────────

section("6. Zod 校验（手机号 / clean-other 互斥 / strict / 长度）");

const validClean = {
  serviceType: "clean",
  cleanTier: "basic80",
  contactName: "张三",
  phone: "13800000000",
  contactPref: "phone",
  brandModel: "联想 拯救者 Y7000P",
  modelPhotos: [],
  description: null,
  serviceMode: "shop",
  preferredTime: "尽快",
  address: null,
};
check("合法 clean 订单通过", orderCreateSchema.safeParse(validClean).success);

// 手机号：格式校验由 service 层 assertPhone 统一抛 40002（API 契约 §1.4），
// Zod 层只拦「非字符串/空/超 11 位」→ 40001
check("空手机号 schema 拒绝", !orderCreateSchema.safeParse({ ...validClean, phone: "" }).success);
check("12 位手机号 schema 拒绝", !orderCreateSchema.safeParse({ ...validClean, phone: "138000000001" }).success);
check("手机号数字类型 schema 拒绝", !orderCreateSchema.safeParse({ ...validClean, phone: 13800000000 }).success);
import { assertPhone as assertOrderPhone } from "../src/server/order-service";
import { assertAftersalePhone } from "../src/server/aftersale-service";
function throws40002(fn: () => void): boolean {
  try {
    fn();
    return false;
  } catch (e) {
    return (e as { code?: number }).code === ErrorCode.INVALID_PHONE;
  }
}
check("座机 → assertPhone 40002", throws40002(() => assertOrderPhone("07541234567")));
check("10 位 → assertPhone 40002", throws40002(() => assertOrderPhone("1380000000")));
check("非 1[3-9] 开头 → 40002", throws40002(() => assertOrderPhone("12800000000")));
check("合法手机号通过", assertOrderPhone("13800000000") === undefined);
check("售后座机 → 40002", throws40002(() => assertAftersalePhone("02012345678")));

// 条件字段互斥（I1/I2）
check("clean 缺 cleanTier 拒绝", !orderCreateSchema.safeParse({ ...validClean, cleanTier: null }).success);
check("clean 提供非空 otherTypes 拒绝", !orderCreateSchema.safeParse({ ...validClean, otherTypes: ["screen"] }).success);
check(
  "other 缺 otherTypes 拒绝",
  !orderCreateSchema.safeParse({ ...validClean, serviceType: "other", cleanTier: null, otherTypes: null }).success,
);
check(
  "other otherTypes=[] 拒绝",
  !orderCreateSchema.safeParse({ ...validClean, serviceType: "other", cleanTier: null, otherTypes: [] }).success,
);
check(
  "other 带 cleanTier 拒绝",
  !orderCreateSchema.safeParse({ ...validClean, serviceType: "other", cleanTier: "basic80", otherTypes: ["screen"] }).success,
);
check(
  "合法 other 订单通过",
  orderCreateSchema.safeParse({ ...validClean, serviceType: "other", cleanTier: null, otherTypes: ["screen", "wifi"] }).success,
);

// B2：otherTypes 含 other 时 description 必填
check(
  "otherTypes 含 other 无描述拒绝",
  !orderCreateSchema.safeParse({ ...validClean, serviceType: "other", cleanTier: null, otherTypes: ["other"], description: null }).success,
);
check(
  "otherTypes 含 other 有描述通过",
  orderCreateSchema.safeParse({ ...validClean, serviceType: "other", cleanTier: null, otherTypes: ["other"], description: "电脑无法开机" }).success,
);

// 地址（I4）
check("shop 带地址拒绝", !orderCreateSchema.safeParse({ ...validClean, serviceMode: "shop", address: "XX 小区" }).success);
check("home 地址留空允许（选填）", orderCreateSchema.safeParse({ ...validClean, serviceMode: "home", address: null }).success);
const emptyAddr = orderCreateSchema.safeParse({ ...validClean, serviceMode: "home", address: "" });
check("address '' → null 归一", emptyAddr.success && emptyAddr.data?.address === null, JSON.stringify(emptyAddr.data?.address));

// strict / 越权字段
check("未知字段拒绝", !orderCreateSchema.safeParse({ ...validClean, foo: 1 }).success);
check("客户端带 status 拒绝", !orderCreateSchema.safeParse({ ...validClean, status: "done" }).success);
check("客户端带 finalPrice 拒绝", !orderCreateSchema.safeParse({ ...validClean, finalPrice: "1.00" }).success);
check("客户端带 remark 拒绝", !orderCreateSchema.safeParse({ ...validClean, remark: "x" }).success);
check("客户端带 notifyStatus 拒绝", !orderCreateSchema.safeParse({ ...validClean, notifyStatus: "success" }).success);

// 长度与格式
check("contactName 21 字拒绝", !orderCreateSchema.safeParse({ ...validClean, contactName: "一".repeat(21) }).success);
check("contactName 20 字通过", orderCreateSchema.safeParse({ ...validClean, contactName: "一".repeat(20) }).success);
check("brandModel 51 字拒绝", !orderCreateSchema.safeParse({ ...validClean, brandModel: "一".repeat(51) }).success);
check("description 301 字拒绝", !orderCreateSchema.safeParse({ ...validClean, description: "一".repeat(301) }).success);
check("description 300 字通过", orderCreateSchema.safeParse({ ...validClean, description: "一".repeat(300) }).success);
check(
  "4 张照片拒绝",
  !orderCreateSchema.safeParse({
    ...validClean,
    modelPhotos: ["/uploads/a.jpg", "/uploads/b.jpg", "/uploads/c.jpg", "/uploads/d.jpg"],
  }).success,
);
check(
  "非 /uploads/ 前缀拒绝",
  !orderCreateSchema.safeParse({ ...validClean, modelPhotos: ["https://evil.com/x.jpg"] }).success,
);
check("期望时间枚举「明天」通过", orderCreateSchema.safeParse({ ...validClean, preferredTime: "明天" }).success);
check("期望时间 yyyy-MM-dd HH:mm 通过", orderCreateSchema.safeParse({ ...validClean, preferredTime: "2026-10-06 14:00" }).success);
check("期望时间「后天」拒绝", !orderCreateSchema.safeParse({ ...validClean, preferredTime: "后天" }).success);

// 售后 schema
check("合法售后通过", aftersaleCreateSchema.safeParse({ phone: "13800000000", description: "风扇响" }).success);
check("售后空描述拒绝", !aftersaleCreateSchema.safeParse({ phone: "13800000000", description: "" }).success);
check("售后 301 字拒绝", !aftersaleCreateSchema.safeParse({ phone: "13800000000", description: "一".repeat(301) }).success);
check("售后空手机号 schema 拒绝", !aftersaleCreateSchema.safeParse({ phone: "", description: "x" }).success);
check("售后未知字段(orderId)拒绝", !aftersaleCreateSchema.safeParse({ phone: "13800000000", description: "x", orderId: "R1" }).success);

// ─── 7. CSV 转义 ──────────────────────────────────────────────────────────────

section("7. CSV 转义（RFC 4180）");

check("普通字段不包裹", csvEscape("联想 Y7000P") === "联想 Y7000P");
check("含逗号包裹", csvEscape("a,b") === '"a,b"');
check("含引号包裹且转义为两个", csvEscape('说"你好"') === '"说""你好"""');
check("含换行包裹", csvEscape("第一行\n第二行") === '"第一行\n第二行"');
check("含 CRLF 包裹", csvEscape("a\r\nb") === '"a\r\nb"');
check("null → 空串", csvEscape(null) === "");
check("undefined → 空串", csvEscape(undefined) === "");
check("行拼接", csvRow(["R20261005-001", "张,三", null]) === 'R20261005-001,"张,三",');

// ─── 附：统一响应构造器 ────────────────────────────────────────────────────────

section("附：统一响应构造器");

const okResp = ok({ a: 1 });
check("ok 结构", okResp.code === 0 && okResp.message === "ok" && okResp.data.a === 1);
const failResp = fail(ErrorCode.DUPLICATED);
check("fail 默认文案（契约原文）", failResp.code === 40003 && failResp.message === "您刚刚已提交过相同的订单" && failResp.data === null);
const fieldResp = failWithField(ErrorCode.INVALID_PHONE, "phone", "请填写正确的 11 位手机号");
check(
  "字段级 data.field/fields",
  fieldResp.data?.field === "phone" && fieldResp.data?.fields?.[0]?.message === "请填写正确的 11 位手机号",
);
check(
  "40004 文案含电话（PRD §5.2.4）",
  fail(ErrorCode.RATE_LIMITED).message === "提交过于频繁，请直接电话 18029516310 或加官方微信",
);
check(
  "50000 文案含电话（PRD REQ-09）",
  fail(ErrorCode.INTERNAL).message === "提交失败，请重试或直接拨打 18029516310",
);

// ─── 8. 真实 DB 冒烟 ──────────────────────────────────────────────────────────

section("8. 真实 DB：createOrder 全链 + 40003/40004 + 40006 + 售后链");

const prisma = new PrismaClient();
const TEST_PHONE = "19900000005"; // 独立测试手机号，避免影响演示数据

async function dbSmoke(): Promise<void> {
  // 幂等清理历史测试数据（含孤儿通知日志：历史运行可能复用今日单号前缀）
  const todayKey = new Date().toISOString().replace(/T.*/, "").replaceAll("-", "");
  const todayOrderPrefix = `R${todayKey}-`;
  const todayAftersalePrefix = `A${todayKey}-`;
  await prisma.notificationLog.deleteMany({
    where: {
      OR: [
        { orderId: { startsWith: todayOrderPrefix } },
        { aftersaleId: { startsWith: todayAftersalePrefix } },
      ],
    },
  });
  await prisma.aftersale.deleteMany({
    where: { OR: [{ phone: TEST_PHONE }, { id: { startsWith: todayAftersalePrefix } }] },
  });
  await prisma.order.deleteMany({
    where: { OR: [{ phone: TEST_PHONE }, { id: { startsWith: todayOrderPrefix } }] },
  });

  const baseInput = {
    serviceType: "clean" as const,
    cleanTier: "deep100" as const,
    otherTypes: null,
    contactName: "验证脚本",
    phone: TEST_PHONE,
    contactPref: "wechat" as const,
    brandModel: "联想 拯救者 Y7000P",
    modelPhotos: ["/uploads/2026/10/test01.jpg"],
    description: "风扇声音大，玩游戏发烫",
    serviceMode: "home" as const,
    preferredTime: "明天",
    address: "测试小区 1 栋 101",
  };

  // 8.1 创建订单（真实落库）
  const { result, order } = await createOrder(baseInput);
  check("订单落库（单号 R 前缀）", /^R\d{8}-\d{3,4}$/.test(order.id), order.id);
  check("响应含 etaText", typeof result.etaText === "string" && result.etaText.length > 0);
  check("响应含 isBusinessHours", typeof result.isBusinessHours === "boolean");
  check("初始 status=pending", order.status === "pending");
  check("notifyStatus 回写 success（console 通道）", order.notifyStatus === "success", order.notifyStatus);

  const logs = await prisma.notificationLog.findMany({ where: { orderId: order.id } });
  check("notification_logs 写入 1 条", logs.length === 1, `实际 ${logs.length}`);
  const log = logs[0];
  check("日志 channel=console / status=success", log?.channel === "console" && log?.status === "success", `${log?.channel}/${log?.status}`);
  const payload = log?.payload ?? "";
  check("payload 含「新订单」与手机号", payload.includes("新订单") && payload.includes(TEST_PHONE));
  check("payload 含类型/套餐行", payload.includes("清灰换硅脂") && payload.includes("深度清洁 ¥100"));
  check("payload 含联系偏好(微信高亮)", payload.includes("💬 微信"));
  check("payload 含机型与照片数", payload.includes("联想 拯救者 Y7000P") && payload.includes("照片 1 张"));
  check("payload 含上门高亮与期望时间", payload.includes("🚪 上门") && payload.includes("明天"));

  // 8.2 立即重复提交 → 40003
  try {
    await createOrder(baseInput);
    check("重复提交 → 40003", false, "未抛出");
  } catch (e) {
    check("重复提交 → 40003", (e as { code?: number }).code === ErrorCode.DUPLICATED, (e as Error).message);
  }

  // 8.3 空值归一去重：与首单同内容但空值形态不同（description '' / modelPhotos []）
  // 注意：首单 description 非空，故此处构造一单「原始可空字段全空」的订单做基准。
  const nullableBase = { ...baseInput, description: null as string | null, modelPhotos: [] as string[] };
  await createOrder(nullableBase); // 落库一单（description=null, modelPhotos=[]）
  try {
    // 改用 ''（归一后 null）与省略（null）提交 → 哈希相同 → 40003
    await createOrder({ ...baseInput, description: "", modelPhotos: [] });
    check("空值归一（''≡null、[]≡null）后仍 40003", false, "未抛出");
  } catch (e) {
    check("空值归一（''≡null、[]≡null）后仍 40003", (e as { code?: number }).code === ErrorCode.DUPLICATED, (e as Error).message);
  }

  // 8.4 当日 5 单限流：已有 2 单（首单 + 空值基准单），再 3 单到满 5，第 6 单 40004
  const order3 = await createOrder({ ...baseInput, description: `第三单 ${Date.now()}` });
  const order4 = await createOrder({ ...baseInput, description: `第四单 ${Date.now()}` });
  const order5 = await createOrder({ ...baseInput, description: `第五单 ${Date.now()}` });
  check("同日 5 单可提交", [order3, order4, order5].every((o) => /^R\d{8}/.test(o.order.id)));
  try {
    await createOrder({ ...baseInput, description: `第六单 ${Date.now()}` });
    check("第 6 单 → 40004", false, "未抛出");
  } catch (e) {
    check("第 6 单 → 40004", (e as { code?: number }).code === ErrorCode.RATE_LIMITED, (e as Error).message);
  }

  // 8.5 座机 → 40002
  try {
    await createOrder({ ...baseInput, phone: "07541234567", description: `座机 ${Date.now()}` });
    check("座机 → 40002", false, "未抛出");
  } catch (e) {
    check("座机 → 40002", (e as { code?: number }).code === ErrorCode.INVALID_PHONE, (e as Error).message);
  }

  // 8.6 状态流转：⚠️ 需备注而未填 → 40006
  try {
    await updateOrder(order.id, { status: "done", remark: null, finalPrice: undefined });
    check("pending→done 无备注 → 40006", false, "未抛出");
  } catch (e) {
    check("pending→done 无备注 → 40006", (e as { code?: number }).code === ErrorCode.ILLEGAL_TRANSITION, (e as Error).message);
  }
  // 回退（processing→pending）无备注 → 40006（API 契约 §5：回退必须留痕）
  await updateOrder(order.id, { status: "processing", remark: "开始处理", finalPrice: undefined });
  try {
    await updateOrder(order.id, { status: "pending", remark: null, finalPrice: undefined });
    check("processing→pending 回退无备注 → 40006", false, "未抛出");
  } catch (e) {
    check(
      "processing→pending 回退无备注 → 40006",
      (e as { code?: number }).code === ErrorCode.ILLEGAL_TRANSITION,
      (e as Error).message,
    );
  }
  // 合法流转 + 备注 + 价格（金额 Decimal 字符串）
  const doneOrder = await updateOrder(order.id, { status: "done", remark: "已交付，收 100 元", finalPrice: "100.00" });
  check("pending→done 带备注成功", doneOrder.status === "done");
  check("finalPrice 字符串两位", doneOrder.finalPrice === "100.00", String(doneOrder.finalPrice));
  try {
    await updateOrder(order.id, { status: "done", remark: null, finalPrice: undefined });
    check("done→done 同状态 → 40006", false, "未抛出");
  } catch (e) {
    check("done→done 同状态 → 40006", (e as { code?: number }).code === ErrorCode.ILLEGAL_TRANSITION);
  }
  check("updated_at 回写", doneOrder.updatedAt.getTime() > order.updatedAt.getTime());

  // 8.7 lookup + 售后链
  const lookup = await lookupOrder(TEST_PHONE);
  check("lookup found", lookup.found === true);
  if (lookup.found) {
    check("lookup 含 orderDate / warrantyEndDate", /^\d{4}-\d{2}-\d{2}$/.test(lookup.orderDate) && /^\d{4}-\d{2}-\d{2}$/.test(lookup.warrantyEndDate));
    check("lookup 今日订单在保", lookup.inWarranty === true);
    const lookupObj = lookup as Record<string, unknown>;
    check("lookup 脱敏（无联系人/地址/描述/照片）", !("contactName" in lookupObj) && !("address" in lookupObj) && !("description" in lookupObj) && !("modelPhotos" in lookupObj));
  }

  const { result: asResult, aftersale } = await createAftersale({
    phone: TEST_PHONE,
    description: "清灰后风扇声音变大",
    media: [],
  });
  check("售后单号 A 前缀", /^A\d{8}-\d{3,4}$/.test(aftersale.id), aftersale.id);
  check("售后 matchedOrderId 命中", typeof asResult.matchedOrderId === "string" && asResult.matchedOrderId!.length > 0);
  check("售后 inWarranty 快照 = true", asResult.inWarranty === true);
  check("售后 etaText 固定文案", asResult.etaText === "已收到，我们会尽快联系您核对");

  // 创建售后不修改 orders.status（契约 §3.2）
  const orderAfter = await prisma.order.findUnique({ where: { id: order.id } });
  check("创建售后不修改 orders.status", orderAfter?.status === "done", String(orderAfter?.status));

  const asLogs = await prisma.notificationLog.findMany({ where: { aftersaleId: aftersale.id } });
  check("售后 notification_logs 写入", asLogs.length === 1, `实际 ${asLogs.length}`);
  check("售后日志 payload 含保修标记", (asLogs[0]?.payload ?? "").includes("7 天内 ✓"));
  check("售后日志 payload 含关联订单号", (asLogs[0]?.payload ?? "").includes(asResult.matchedOrderId ?? "__"));

  // 8.8 售后重复提交 → 40003（同手机号 + 同描述 10 分钟）
  try {
    await createAftersale({ phone: TEST_PHONE, description: "清灰后风扇声音变大", media: [] });
    check("售后重复提交 → 40003", false, "未抛出");
  } catch (e) {
    check("售后重复提交 → 40003", (e as { code?: number }).code === ErrorCode.DUPLICATED, (e as Error).message);
  }

  // 8.9 清理测试数据（保留演示数据）
  // 注意：先收集全部测试单号（订单 + 售后），再统一删日志、删业务行，
  // 避免「按 orderId 先删了售后」导致后续按手机号查不到、漏删日志。
  const testOrderIds = (await prisma.order.findMany({ where: { phone: TEST_PHONE }, select: { id: true } })).map((o) => o.id);
  const testAftersaleIds = (await prisma.aftersale.findMany({ where: { phone: TEST_PHONE }, select: { id: true } })).map((a) => a.id);
  for (const id of testOrderIds) await prisma.notificationLog.deleteMany({ where: { orderId: id } });
  for (const id of testAftersaleIds) await prisma.notificationLog.deleteMany({ where: { aftersaleId: id } });
  await prisma.aftersale.deleteMany({ where: { OR: [{ phone: TEST_PHONE }, { orderId: { in: testOrderIds } }] } });
  await prisma.order.deleteMany({ where: { phone: TEST_PHONE } });
  const remain = await prisma.order.count({ where: { phone: TEST_PHONE } });
  const remainAs = await prisma.aftersale.count({ where: { phone: TEST_PHONE } });
  const remainLogs = await prisma.notificationLog.count({
    where: { OR: [{ orderId: { in: testOrderIds } }, { aftersaleId: { in: testAftersaleIds } }] },
  });
  check("测试数据已清理（订单/售后/日志）", remain === 0 && remainAs === 0 && remainLogs === 0, `订单 ${remain} / 售后 ${remainAs} / 日志 ${remainLogs}`);

  // 演示数据未被破坏（不得删除演示数据）
  const demo1 = await prisma.order.findUnique({ where: { id: "R20261005-001" } });
  const demo2 = await prisma.order.findUnique({ where: { id: "R20261004-001" } });
  const demoAs = await prisma.aftersale.findUnique({ where: { id: "A20261005-001" } });
  check("演示数据完好（2 单 + 1 售后）", !!demo1 && !!demo2 && !!demoAs);
}

dbSmoke()
  .catch((e) => {
    failed += 1;
    console.error("\n[DB 冒烟异常]", e);
  })
  .finally(async () => {
    await prisma.$disconnect();
    console.log(`\n===== 结果：${passed} 通过 / ${failed} 失败 =====`);
    process.exit(failed > 0 ? 1 : 0);
  });
