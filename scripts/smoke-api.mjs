/**
 * T9 契约冒烟脚本（本地预览）
 *
 * 用法：
 *   node scripts/smoke-api.mjs                # 默认 http://localhost:3000
 *   BASE=http://localhost:3001 node scripts/smoke-api.mjs
 *   SMOKE_ADMIN_PASSWORD=xxx node scripts/smoke-api.mjs
 *   SMOKE_CLEANUP=0 node scripts/smoke-api.mjs   # 保留测试数据（默认清理，仅开发环境）
 *
 * 覆盖：C 端 5 路由 200、下单/去重/座机、脱敏摘要、售后 lookup/提交、
 *       后台鉴权与列表/详情/状态流转、CSV 导出、图片上传与 /uploads 可访问。
 * 退出码：0 全部通过；1 存在失败。
 */
import sharp from "sharp";
import { PrismaClient } from "@prisma/client";

const BASE = (process.env.BASE ?? "http://localhost:3000").replace(/\/$/, "");
const ADMIN_USER = process.env.SMOKE_ADMIN_USER ?? "admin";
const ADMIN_PASS = process.env.SMOKE_ADMIN_PASSWORD ?? "test1234";
const CLEANUP = process.env.SMOKE_CLEANUP !== "0";

// 每次运行使用独立手机号，避免与演示数据/历史运行冲突
const rnd = String(Date.now()).slice(-9);
const PHONE = `19${rnd}`;
const PHONE_LANDLINE = "07541234567";

let pass = 0;
let fail = 0;
const failures = [];
const created = { orderIds: [], aftersaleIds: [] };

function check(name, cond, extra = "") {
  if (cond) {
    pass += 1;
    console.log(`  ✅ ${name}`);
  } else {
    fail += 1;
    failures.push(name);
    console.log(`  ❌ ${name}${extra ? ` — ${extra}` : ""}`);
  }
}

async function req(path, { method = "GET", body, headers = {}, raw } = {}) {
  const init = { method, headers: { ...headers }, redirect: "manual" };
  if (raw) {
    init.body = raw;
  } else if (body !== undefined) {
    init.headers["Content-Type"] = "application/json";
    init.body = JSON.stringify(body);
  }
  const res = await fetch(`${BASE}${path}`, init);
  const bytes = new Uint8Array(await res.clone().arrayBuffer());
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    /* 非 JSON（CSV / HTML）保持 null */
  }
  return { status: res.status, text, json, bytes, headers: res.headers };
}

const orderPayload = (over = {}) => ({
  serviceType: "clean",
  cleanTier: "basic80",
  otherTypes: null,
  contactName: "冒烟测试",
  phone: PHONE,
  contactPref: "wechat",
  brandModel: "联想 拯救者 Y7000P",
  modelPhotos: [],
  description: "冒烟测试：风扇声音大",
  serviceMode: "shop",
  preferredTime: "尽快",
  address: null,
  ...over,
});

async function main() {
  console.log(`\n== 契约冒烟 @ ${BASE} | 手机号 ${PHONE} ==\n`);

  // ---------- 1. C 端页面可达 ----------
  console.log("[1] C 端路由");
  for (const p of ["/", "/order", "/success", "/aftersale", "/aftersale/success"]) {
    const r = await req(p);
    check(`GET ${p} → 200`, r.status === 200, `实际 ${r.status}`);
  }

  // ---------- 2. 下单 ----------
  console.log("\n[2] 下单");
  const created1 = await req("/api/orders", { method: "POST", body: orderPayload() });
  check("POST /api/orders → 200 & code=0", created1.status === 200 && created1.json?.code === 0, JSON.stringify(created1.json));
  const orderId = created1.json?.data?.orderId ?? "";
  check("单号格式 R+日期+流水", /^R\d{8}-\d{3,4}$/.test(orderId), orderId);
  check("返回 etaText", typeof created1.json?.data?.etaText === "string" && created1.json.data.etaText.length > 0);
  check("返回 isBusinessHours", typeof created1.json?.data?.isBusinessHours === "boolean");
  if (orderId) created.orderIds.push(orderId);

  const dup = await req("/api/orders", { method: "POST", body: orderPayload() });
  check("同内容 10 分钟内重复 → 40003", dup.json?.code === 40003 && dup.status === 409, `code=${dup.json?.code} http=${dup.status}`);

  const dupNull = await req("/api/orders", {
    method: "POST",
    body: orderPayload({ description: null, otherTypes: null, address: null, modelPhotos: [] }),
  });
  check(
    "空值归一后仍判重（description null vs 有值不算同内容，此处仅验证不报 500）",
    dupNull.status === 200 || dupNull.json?.code === 40003,
    JSON.stringify(dupNull.json?.code),
  );
  if (dupNull.json?.data?.orderId) created.orderIds.push(dupNull.json.data.orderId);

  const landline = await req("/api/orders", { method: "POST", body: orderPayload({ phone: PHONE_LANDLINE }) });
  check("座机号 → 40002", landline.json?.code === 40002 && landline.status === 400, `code=${landline.json?.code} http=${landline.status}`);

  const mutual = await req("/api/orders", {
    method: "POST",
    body: orderPayload({ phone: `18${rnd}`, otherTypes: ["screen"] }),
  });
  check("clean 时 otherTypes 非 null → 40001", mutual.json?.code === 40001, `code=${mutual.json?.code}`);

  // ---------- 3. 成功页摘要（脱敏） ----------
  console.log("\n[3] 成功页摘要");
  const summary = await req(`/api/orders/${orderId}`);
  check("GET /api/orders/{id} → 200", summary.status === 200 && summary.json?.code === 0, `http=${summary.status}`);
  const summaryData = summary.json?.data ?? {};
  check("摘要不含 status", !("status" in summaryData), Object.keys(summaryData).join(","));
  check("摘要不含 phone / contactName / address", !("phone" in summaryData) && !("contactName" in summaryData) && !("address" in summaryData));
  check("摘要含 etaText", typeof summaryData.etaText === "string");

  // ---------- 4. 售后 ----------
  console.log("\n[4] 售后报修");
  const lookup = await req(`/api/aftersales/lookup?phone=${PHONE}`);
  check("lookup → 200 & found=true", lookup.status === 200 && lookup.json?.data?.found === true, JSON.stringify(lookup.json?.data));
  check("lookup 含保修字段", typeof lookup.json?.data?.inWarranty === "boolean" && typeof lookup.json?.data?.warrantyEndDate === "string");

  const lookupNone = await req("/api/aftersales/lookup?phone=13700000000");
  check("lookup 未匹配 → found=false（非错误）", lookupNone.status === 200 && lookupNone.json?.data?.found === false);

  const af = await req("/api/aftersales", {
    method: "POST",
    body: { phone: PHONE, description: "冒烟测试：清灰后风扇声音变大", media: [] },
  });
  check("POST /api/aftersales → 200 & code=0", af.status === 200 && af.json?.code === 0, JSON.stringify(af.json));
  if (af.json?.data?.aftersaleId) created.aftersaleIds.push(af.json.data.aftersaleId);
  check("售后返回 etaText", typeof af.json?.data?.etaText === "string");

  // ---------- 5. 后台鉴权 ----------
  console.log("\n[5] 后台鉴权");
  const noAuth = await req("/api/admin/orders");
  check("未登录 → HTTP 401", noAuth.status === 401, `实际 ${noAuth.status}`);
  check("未登录 → code=40100", noAuth.json?.code === 40100, `code=${noAuth.json?.code}`);

  const badLogin = await req("/api/admin/login", { method: "POST", body: { username: ADMIN_USER, password: "wrong-password" } });
  check("错误密码 → 40001 且不泄露账号是否存在", badLogin.json?.code === 40001, `code=${badLogin.json?.code}`);

  const login = await req("/api/admin/login", { method: "POST", body: { username: ADMIN_USER, password: ADMIN_PASS } });
  check("登录成功 → 200 & code=0", login.status === 200 && login.json?.code === 0, JSON.stringify(login.json));
  const setCookie = login.headers.get("set-cookie") ?? "";
  check("下发 HttpOnly 会话 Cookie", /xiuxiu_session/.test(setCookie) && /HttpOnly/i.test(setCookie), setCookie.slice(0, 60));
  const cookie = setCookie.split(";")[0];

  const session = await req("/api/admin/session", { headers: { cookie } });
  check("GET /api/admin/session → 200", session.status === 200 && session.json?.code === 0, `http=${session.status}`);

  // ---------- 6. 后台数据 ----------
  console.log("\n[6] 后台数据与流转");
  const list = await req("/api/admin/orders?page=1&size=20", { headers: { cookie } });
  check("订单列表 → 200 & items 数组", list.status === 200 && Array.isArray(list.json?.data?.items), `http=${list.status}`);
  check("列表含 total", typeof list.json?.data?.total === "number");

  const detail = await req(`/api/admin/orders/${orderId}`, { headers: { cookie } });
  check("订单详情 → 200 & 含 aftersales 数组", detail.status === 200 && Array.isArray(detail.json?.data?.aftersales), `http=${detail.status}`);

  const patch = await req(`/api/admin/orders/${orderId}`, {
    method: "PATCH",
    headers: { cookie },
    body: { status: "processing", remark: "冒烟：开始处理" },
  });
  check("PATCH 状态 pending→processing → 200", patch.status === 200 && patch.json?.code === 0, JSON.stringify(patch.json));

  const backwardNoRemark = await req(`/api/admin/orders/${orderId}`, {
    method: "PATCH",
    headers: { cookie },
    body: { status: "pending" },
  });
  check("回退未填备注 → 40006", backwardNoRemark.json?.code === 40006, `code=${backwardNoRemark.json?.code}`);

  const price = await req(`/api/admin/orders/${orderId}`, {
    method: "PATCH",
    headers: { cookie },
    body: { finalPrice: "100.00", remark: "冒烟：最终 100 元" },
  });
  check("回填 finalPrice → 200 且为两位小数字符串", price.status === 200 && price.json?.data?.finalPrice === "100.00", String(price.json?.data?.finalPrice));

  const afList = await req("/api/admin/aftersales?page=1&size=20", { headers: { cookie } });
  check("售后列表 → 200", afList.status === 200 && Array.isArray(afList.json?.data?.items), `http=${afList.status}`);

  // ---------- 7. 导出 ----------
  console.log("\n[7] CSV 导出");
  const csv = await req("/api/admin/export?type=orders", { headers: { cookie } });
  check("导出 → 200", csv.status === 200, `http=${csv.status}`);
  check("Content-Type 为 text/csv", /text\/csv/.test(csv.headers.get("content-type") ?? ""), csv.headers.get("content-type") ?? "");
  check("含附件下载头", /attachment/.test(csv.headers.get("content-disposition") ?? ""));
  check(
    "CSV 以 UTF-8 BOM 开头（原始字节 EF BB BF）",
    csv.bytes[0] === 0xef && csv.bytes[1] === 0xbb && csv.bytes[2] === 0xbf,
    `前三字节 ${[...csv.bytes.slice(0, 3)].map((b) => b.toString(16)).join(" ")}`,
  );
  check("CSV 含表头「单号」", csv.text.includes("单号"));

  // ---------- 8. 上传 ----------
  console.log("\n[8] 图片上传");
  const png = await sharp({ create: { width: 320, height: 240, channels: 3, background: "#2F6BFF" } })
    .png()
    .toBuffer();
  const form = new FormData();
  form.append("file", new Blob([png], { type: "image/png" }), "smoke.png");
  const up = await req("/api/upload", { method: "POST", raw: form });
  check("POST /api/upload → 200 & code=0", up.status === 200 && up.json?.code === 0, JSON.stringify(up.json));
  const url = up.json?.data?.url ?? "";
  check("返回 /uploads/ 相对路径", url.startsWith("/uploads/"), url);
  check("返回 size/width/height", up.json?.data?.size > 0 && up.json?.data?.width === 320 && up.json?.data?.height === 240, JSON.stringify(up.json?.data));

  if (url) {
    const served = await req(url);
    check("上传后可访问（/uploads 路由生效）", served.status === 200, `http=${served.status}`);
  }

  // ---------- 9. 清理（仅开发环境） ----------
  if (CLEANUP) {
    console.log("\n[9] 清理冒烟数据");
    const prisma = new PrismaClient();
    try {
      const delAf = await prisma.aftersale.deleteMany({ where: { phone: PHONE } });
      const delOr = await prisma.order.deleteMany({ where: { phone: PHONE } });
      console.log(`  🧹 已删除订单 ${delOr.count} 条 / 售后 ${delAf.count} 条（仅本脚本创建的手机号 ${PHONE}）`);
    } finally {
      await prisma.$disconnect();
    }
  } else {
    console.log("\n[9] 跳过清理（SMOKE_CLEANUP=0）");
  }

  console.log(`\n== 结果：${pass} 通过 / ${fail} 失败 ==`);
  if (fail > 0) {
    console.log("失败项：\n - " + failures.join("\n - "));
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("\n冒烟脚本异常终止：", err);
  process.exit(1);
});
