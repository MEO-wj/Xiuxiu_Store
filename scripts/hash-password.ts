/**
 * 生成后台管理员密码的 bcrypt 哈希（cost 10）。
 *
 * 用法：
 *   pnpm hash-password 你的密码
 *
 * 输出可直接粘贴到 .env 的行：
 *   ADMIN_PASSWORD_HASH=$2a$10$...
 *
 * 契约：docs/api/Xiuxiu_数据库契约_v1.0.md §3.3（bcrypt cost 10，禁止明文）
 */
import bcrypt from "bcryptjs";

const arg = process.argv[2];

if (!arg) {
  console.error("用法：pnpm hash-password 你的密码");
  console.error("示例：pnpm hash-password test1234");
  process.exit(1);
}

const hash = bcrypt.hashSync(arg, 10);

console.log(hash);
console.log(`ADMIN_PASSWORD_HASH=${hash}`);
