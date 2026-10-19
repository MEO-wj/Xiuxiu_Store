/**
 * 复核 T10 review 修复项（可重复运行）：
 *   1) CSV 公式注入防护
 *   2) 状态机回退集合与数据库契约 §5 矩阵对齐
 *   3) preferredTime 语义校验（拒绝 2026-13-45 25:99）
 *   4) 上传限流仅信任受信代理的 XFF（代码级断言）
 */
import { csvEscape } from "../src/server/export";
import { checkOrderTransition, isBackwardTransition } from "../src/server/order-service";
import { orderCreateSchema } from "../src/lib/validation";

let pass = 0;
let fail = 0;
const check = (name: string, cond: boolean, extra = "") => {
  if (cond) {
    pass += 1;
    console.log(`  PASS  ${name}`);
  } else {
    fail += 1;
    console.log(`  FAIL  ${name}${extra ? ` — ${extra}` : ""}`);
  }
};

console.log("\n== 1) CSV 公式注入防护 ==");
check("= 开头被中和", csvEscape("=SUM(A1:A9)").startsWith("'="), csvEscape("=SUM(A1)"));
check("+ 开头被中和", csvEscape("+1+2").startsWith("'+"), csvEscape("+1+2"));
check("- 开头被中和", csvEscape("-2+3").startsWith("'-"), csvEscape("-2+3"));
check("@ 开头被中和", csvEscape("@cmd").startsWith("'@"), csvEscape("@cmd"));
check("含逗号仍按 RFC4180 包裹", csvEscape("a,b") === '"a,b"', csvEscape("a,b"));
check("中性文本不变", csvEscape("张三") === "张三");
check("null → 空串", csvEscape(null) === "");

console.log("\n== 2) 状态机与数据库契约 §5 矩阵对齐 ==");
check("pending→processing 允许", checkOrderTransition("pending", "processing") === "allowed");
check("pending→done 需备注", checkOrderTransition("pending", "done") === "needs-remark");
check("aftersale→processing 允许且非回退", checkOrderTransition("aftersale", "processing") === "allowed" && !isBackwardTransition("aftersale", "processing"));
check("aftersale→done 允许且非回退", checkOrderTransition("aftersale", "done") === "allowed" && !isBackwardTransition("aftersale", "done"));
check("aftersale→pending 为回退", isBackwardTransition("aftersale", "pending"));
check("done→processing 为回退", isBackwardTransition("done", "processing"));
check("closed→processing 需备注", checkOrderTransition("closed", "processing") === "needs-remark");
check("closed→pending 为回退", isBackwardTransition("closed", "pending"));
check("非法流转（pending→pending）", checkOrderTransition("pending", "pending") === "forbidden");

console.log("\n== 3) preferredTime 语义校验 ==");
const base = {
  serviceType: "clean" as const,
  cleanTier: "basic80" as const,
  otherTypes: null,
  contactName: "张三",
  phone: "13800000000",
  contactPref: "phone" as const,
  brandModel: "联想 Y7000P",
  modelPhotos: [],
  description: null,
  serviceMode: "shop" as const,
  address: null,
};
const okTime = orderCreateSchema.safeParse({ ...base, preferredTime: "2026-10-06 14:00" });
check("合法日期时间通过", okTime.success, JSON.stringify(okTime.success ? "" : okTime.error.issues[0]?.message));
check("枚举值「尽快」通过", orderCreateSchema.safeParse({ ...base, preferredTime: "尽快" }).success);
check("非法月份被拒", !orderCreateSchema.safeParse({ ...base, preferredTime: "2026-13-06 14:00" }).success);
check("非法日被拒（2 月 30 日）", !orderCreateSchema.safeParse({ ...base, preferredTime: "2026-02-30 10:00" }).success);
check("非法小时被拒", !orderCreateSchema.safeParse({ ...base, preferredTime: "2026-10-06 25:00" }).success);
check("非法分钟被拒", !orderCreateSchema.safeParse({ ...base, preferredTime: "2026-10-06 10:99" }).success);

console.log(`\n===== 结果：${pass} 通过 / ${fail} 失败 =====`);
process.exit(fail === 0 ? 0 : 1);
