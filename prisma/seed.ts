/**
 * 种子脚本（幂等，契约 §11）
 *
 * 模式（环境变量 SEED_MODE）：
 *   - demo（本地/预发默认，须显式或未设置时……见下方说明）：管理员 + 2 条演示订单 + 1 条演示售后
 *   - admin（生产）：仅创建管理员，不写入任何演示数据
 *
 * ⚠️ 契约 §11 规定「生产默认 SEED_MODE=admin（未显式设置时按 admin 处理）」，
 *    但 .env.example 默认 SEED_MODE=demo（本地开发）。本脚本实现：
 *    - 显式设置 demo / admin 之一 → 按该值执行
 *    - 未设置 → 按 admin（生产安全优先，符合契约）
 *
 * 幂等方式：全部 upsert（管理员 by username，订单/售后 by id），重复执行不产生重复数据。
 * 运行前提：已执行 pnpm db:push（表结构存在）。
 *
 * 演示数据内容（契约 §11 表格 + 开发文档 §6.4）：
 *   - 演示订单 1 R20261005-001：清灰换硅脂·深度清洁 ¥100、上门、微信联系、pending、2 张占位照片
 *   - 演示订单 2 R20261004-001：其他问题·屏幕故障、到店、电话联系、done
 *   - 演示售后  A20261005-001：关联演示订单 1、in_warranty=true、pending
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

// ─── 环境变量 ───────────────────────────────────────────────────────────────

const SEED_MODE = (process.env.SEED_MODE ?? "admin").toLowerCase(); // 未显式设置 → admin（契约 §11）
const ADMIN_USERNAME = process.env.ADMIN_USERNAME ?? "admin";
/** 未提供哈希时使用该开发默认密码 admin12345 的 bcrypt（cost 10）——仅本地便利，生产必须在 .env 提供 ADMIN_PASSWORD_HASH */
const DEV_FALLBACK_PASSWORD = "admin12345";

// ─── 演示数据（仅 demo 模式） ───────────────────────────────────────────────

const DEMO_ORDER_1_ID = "R20261005-001";
const DEMO_ORDER_2_ID = "R20261004-001";
const DEMO_AFTERSALE_ID = "A20261005-001";

async function seedAdmin() {
  // 优先使用 .env 的 ADMIN_PASSWORD_HASH；未提供则用开发默认密码（幂等：upsert by username）
  const providedHash = process.env.ADMIN_PASSWORD_HASH?.trim();
  const passwordHash =
    providedHash && providedHash.length > 0
      ? providedHash
      : bcrypt.hashSync(DEV_FALLBACK_PASSWORD, 10);

  if (!providedHash) {
    console.warn(
      `[seed] 未设置 ADMIN_PASSWORD_HASH，使用开发默认密码「${DEV_FALLBACK_PASSWORD}」的哈希（仅限本地开发，生产必须在 .env 配置 ADMIN_PASSWORD_HASH）`,
    );
  }

  const admin = await prisma.adminUser.upsert({
    where: { username: ADMIN_USERNAME },
    update: { passwordHash }, // 重复执行时刷新为当前 .env 的哈希，保证账号可用
    create: { username: ADMIN_USERNAME, passwordHash },
  });

  console.log(`[seed] 管理员就绪：username=${admin.username}（mode=${SEED_MODE}）`);
  return admin;
}

async function seedDemoData() {
  // ── 演示订单 1：清灰 · 深度清洁 ¥100 · 上门(home) · 微信联系(wechat) · pending ──
  await prisma.order.upsert({
    where: { id: DEMO_ORDER_1_ID },
    update: {},
    create: {
      id: DEMO_ORDER_1_ID,
      serviceType: "clean", // 覆盖 serviceType=clean
      cleanTier: "deep100", // 深度清洁 ¥100
      otherTypes: [],
      contactName: "陈小满",
      phone: "13800001001",
      contactPref: "wechat", // 覆盖 contactPref=wechat
      brandModel: "联想 拯救者 Y7000P",
      modelPhotos: ["/uploads/seed/model-01.jpg", "/uploads/seed/model-02.jpg"],
      description: "玩游戏温度偏高，想做深度清灰换硅脂。",
      serviceMode: "home", // 覆盖 serviceMode=home
      preferredTime: "明天",
      address: "天河区体育东路 100 号 3 栋 502", // service_mode=home 允许非空（不变量 I4）
      status: "pending", // 状态 pending
      notifyStatus: "success",
    },
  });
  console.log(`[seed] 演示订单 1 就绪：${DEMO_ORDER_1_ID}（clean · deep100 · home · wechat · pending）`);

  // ── 演示订单 2：其他问题 · 屏幕故障(screen) · 到店(shop) · 电话联系(phone) · done ──
  await prisma.order.upsert({
    where: { id: DEMO_ORDER_2_ID },
    update: {},
    create: {
      id: DEMO_ORDER_2_ID,
      serviceType: "other", // 覆盖 serviceType=other
      cleanTier: null,
      otherTypes: ["screen"], // 屏幕故障
      contactName: "林晓",
      phone: "13900002002",
      contactPref: "phone", // 覆盖 contactPref=phone
      brandModel: "苹果 MacBook Air M2 13\"",
      modelPhotos: [],
      description: "屏幕左下角出现亮斑，偶尔闪烁。",
      serviceMode: "shop", // 覆盖 serviceMode=shop
      preferredTime: "尽快",
      address: null, // shop ⇒ address 必须为空（不变量 I4）
      status: "done", // 状态 done
      finalPrice: 380,
      remark: "更换屏幕排线，已交付。",
      notifyStatus: "success",
    },
  });
  console.log(`[seed] 演示订单 2 就绪：${DEMO_ORDER_2_ID}（other · screen · shop · phone · done）`);

  // ── 演示售后：关联演示订单 1 · in_warranty=true · pending ──
  await prisma.aftersale.upsert({
    where: { id: DEMO_AFTERSALE_ID },
    update: {},
    create: {
      id: DEMO_AFTERSALE_ID,
      phone: "13800001001", // 与关联订单一致（不变量 I8）
      orderId: DEMO_ORDER_1_ID, // 关联演示订单 1
      inWarranty: true, // 契约 §11：in_warranty=true
      description: "清灰后风扇声音比之前大，想复查一下。",
      media: ["/uploads/seed/aftersale-01.jpg"],
      status: "pending",
    },
  });
  console.log(`[seed] 演示售后就绪：${DEMO_AFTERSALE_ID}（关联 ${DEMO_ORDER_1_ID} · in_warranty=true · pending）`);
}

async function main() {
  console.log(`[seed] SEED_MODE=${SEED_MODE}`);

  // 两种模式都必须创建管理员（契约 §11）
  await seedAdmin();

  if (SEED_MODE === "demo") {
    await ensureSeedPhotos();
    await seedDemoData();
    console.log("[seed] demo 模式完成：管理员 + 2 条演示订单 + 1 条演示售后（幂等 upsert）");
  } else if (SEED_MODE === "admin") {
    console.log("[seed] admin 模式完成：仅管理员，无演示数据（生产安全）");
  } else {
    throw new Error(`未知的 SEED_MODE="${SEED_MODE}"（仅支持 demo / admin）`);
  }
}


/** 生成演示订单引用的占位照片（幂等；仅 demo 模式调用） */
async function ensureSeedPhotos(): Promise<void> {
  const { mkdir, access } = await import("node:fs/promises");
  const path = await import("node:path");
  const sharp = (await import("sharp")).default;
  const dir = path.join(process.cwd(), "storage", "uploads", "seed");
  await mkdir(dir, { recursive: true });
  for (const name of ["model-01.jpg", "model-02.jpg"]) {
    const file = path.join(dir, name);
    try {
      await access(file);
      continue; // 已存在 → 跳过（幂等）
    } catch {
      /* 不存在则生成 */
    }
    await sharp({
      create: { width: 600, height: 400, channels: 3, background: "#F2F4F8" },
    })
      .jpeg({ quality: 80 })
      .toFile(file);
  }
}

main()
  .catch((e) => {
    console.error("[seed] 失败：", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
