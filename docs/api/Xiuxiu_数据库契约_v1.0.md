# 「xiu xiu」客户下单系统 · 数据库契约

## 0. 文档信息

| 项目 | 内容 |
| --- | --- |
| 文档名称 | 数据库契约（Data Contract） |
| 版本 | v1.0 |
| 日期 | 2026-10-05 |
| 状态 | 待评审确认 |
| 引擎 | **PostgreSQL 16**（本地 Docker / 生产云数据库，同引擎同大版本） |
| 上级文档 | `docs/plan/Xiuxiu_开发文档_v1.1.md` §3（数据库设计） |
| 需求来源 | `docs/prd/Xiuxiu_PRD_v1.3.md` §8 数据模型 |
| 契约效力 | 本文档是表结构、取值域、约束与迁移规则的**唯一权威**；接口字段命名遵循 `docs/api/Xiuxiu_API契约_v1.0.md` |

> **契约变更规则**：任何字段增删改，必须依次完成 ① 更新本文档 → ② 更新 Prisma 模型 → ③ 生成迁移文件 → ④ 更新 API 契约与前端类型 → ⑤ 记录到变更日志。**禁止绕过本文档直接在数据库上改结构。**

### 0.1 变更日志

| 版本 | 变更 |
| --- | --- |
| v1.0 | 初版：orders / aftersales / admin_users / notification_logs 四表契约、取值域、不变量、索引、事务边界、迁移与生命周期 |
| v1.0 | 开工前基线校正（T14，同日）：统一保修口径与生产迁移/种子规则，补充索引实现说明 |

---

## 1. 环境与总体约定

| 项 | 约定 |
| --- | --- |
| 引擎版本 | PostgreSQL 16（本地镜像 `postgres:16`，生产云实例同版本） |
| 字符集 | `UTF8`（`ENCODING 'UTF8'`） |
| 排序规则 | 默认；本项目关键查询为手机号/单号精确匹配，不依赖 collation |
| 时区策略 | 字段一律 `TIMESTAMPTZ(3)`，**库内存 UTC**；展示与营业时间判断统一按 `Asia/Shanghai`（`src/lib/format.ts` 集中处理） |
| 主键策略 | 业务表用业务单号（`VARCHAR(24)`）作主键；辅助表用 `IDENTITY` 自增 |
| 金额 | `NUMERIC(10,2)`（Prisma `Decimal`），禁止用浮点 |
| 布尔 | `BOOLEAN`（禁止 `0/1` 整数） |
| 数组 | 原生 `TEXT[]`（Prisma `String[]`），禁止逗号拼接字符串 |
| 枚举 | `VARCHAR` + 应用层枚举（§4 值域表），**不使用数据库 ENUM** |
| 字符串长度 | DB 长度是**宽限上限**；业务上限由 Zod 校验层控制（§5 不变量） |
| 删除策略 | 业务数据**不做物理删除**（订单/售后仅改状态）；异常数据由店主在后台标注 |
| 命名 | 表名：小写复数 snake_case；字段：snake_case；Prisma 模型：PascalCase + `@@map` |

---

## 2. 表关系

```
orders  1 ──── 0..1  aftersales        （aftersales.order_id，可空）
orders  /  aftersales  1 ──── 0..n  notification_logs（通过 order_id / aftersale_id 弱关联，不设外键）
admin_users                             （独立，无外键）
```

| 关系 | 基数 | 说明 |
| --- | --- | --- |
| `orders` → `aftersales` | 1 : 0..n | 一笔订单可能被多次报修；`order_id` 允许为空（未匹配到订单的报修） |
| `notification_logs` → `orders` / `aftersales` | 0..n : 1 | **刻意不设外键**：通知日志是审计数据，不能因业务数据变更而受限或级联删除 |

---

## 3. 数据字典

### 3.1 `orders` — 订单

| # | 字段 | 类型 | 可空 | 默认 | 取值域 / 约束 | 业务含义 | 索引 | PRD 出处 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `VARCHAR(24)` | 否 | — | `R` + `yyyyMMdd` + `-` + 3 位流水，唯一（主键） | 订单号 | PK | §8 |
| 2 | `service_type` | `VARCHAR(16)` | 否 | — | `clean` / `other` | 服务类型 | — | REQ-05 |
| 3 | `clean_tier` | `VARCHAR(16)` | 是 | — | `basic80` / `deep100`；`service_type=clean` 时必填 | 清灰套餐档位 | — | REQ-06 A1 |
| 4 | `other_types` | `TEXT[]` | 是 | — | 元素 ∈ {`screen`,`wifi`,`slow`,`other`}，长度 ≥1；仅 `service_type=other` | 问题类型多选 | `GIN`（可选） | REQ-07 B1 |
| 5 | `contact_name` | `VARCHAR(40)` | 否 | — | 1–20 字 | 联系人 | — | A2 |
| 6 | `phone` | `VARCHAR(11)` | 否 | — | `^1[3-9]\d{9}$`（**拒座机**） | 手机号（业务主键） | ✔ 复合 | A3 |
| 7 | `contact_pref` | `VARCHAR(16)` | 否 | — | `phone` / `wechat` | 联系偏好 | — | A7 / REQ-17 |
| 8 | `brand_model` | `VARCHAR(100)` | 否 | — | 1–50 字 | 品牌 / 型号 | — | A4 |
| 9 | `model_photos` | `TEXT[]` | 是 | — | 长度 ≤3；元素以 `/uploads/` 开头 | 型号照片 URL | — | A5 / REQ-08 |
| 10 | `description` | `VARCHAR(600)` | 是 | — | ≤300 字 | 故障描述 | — | A6 |
| 11 | `service_mode` | `VARCHAR(16)` | 否 | — | `shop` / `home` | 服务方式 | — | A8 |
| 12 | `preferred_time` | `VARCHAR(64)` | 是 | — | `尽快` / `今天` / `明天` / `yyyy-MM-dd HH:mm` | 期望时间 | — | A9 |
| 13 | `address` | `VARCHAR(200)` | 是 | — | ≤100 字；仅 `service_mode=home` 允许非空 | 上门地址（选填） | — | A10 |
| 14 | `status` | `VARCHAR(16)` | 否 | `'pending'` | `pending`/`processing`/`done`/`aftersale`/`closed` | 订单状态 | ✔ 复合 | §7.5 / REQ-14 |
| 15 | `final_price` | `NUMERIC(10,2)` | 是 | — | ≥ 0 且 ≤ 999999.99 | 最终成交价（含上门加价） | — | §7.1 |
| 16 | `remark` | `VARCHAR(500)` | 是 | — | ≤500 字 | 店主备注 | — | REQ-13 |
| 17 | `notify_status` | `VARCHAR(16)` | 否 | `'pending'` | `pending`/`success`/`failed` | 店主通知结果（漏单兜底） | — | 技术补充 |
| 18 | `created_at` | `TIMESTAMPTZ(3)` | 否 | `now()` | — | 下单时间（去重/限流/保修基准） | ✔ | §8 |
| 19 | `updated_at` | `TIMESTAMPTZ(3)` | 否 | `now()` | 由应用层在更新时写入 | 更新时间 | — | §8 |

**索引**

| 索引名 | 定义 | 服务的查询 |
| --- | --- | --- |
| `orders_pkey` | (`id`) | 主键 / 后台详情 |
| `idx_orders_phone_created` | (`phone`, `created_at` DESC) | 售后匹配最近一单；同手机号 10 分钟去重；当日 5 单限流 |
| `idx_orders_status_created` | (`status`, `created_at` DESC) | 后台按状态筛选 + 时间倒序列表 |
| `idx_orders_created` | (`created_at` DESC) | 导出、统计 |
| `idx_orders_other_types` | `GIN (other_types)` | 可选：按问题类型筛选。**Prisma 无法声明 GIN 索引**，需在迁移 SQL 中手工添加；若不使用问题类型筛选可暂不创建 |

### 3.2 `aftersales` — 售后报修

| # | 字段 | 类型 | 可空 | 默认 | 取值域 / 约束 | 业务含义 | 索引 | PRD 出处 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `VARCHAR(24)` | 否 | — | `A` + `yyyyMMdd` + `-` + 3 位流水（主键） | 售后单号 | PK | §8 |
| 2 | `phone` | `VARCHAR(11)` | 否 | — | 同 `orders.phone` | 报修手机号 | ✔ | C1 |
| 3 | `order_id` | `VARCHAR(24)` | 是 | — | 若不为空，必须存在于 `orders.id`（FK） | 自动匹配的原订单 | ✔ | C2 |
| 4 | `in_warranty` | `BOOLEAN` | 否 | `false` | 写入时快照：交付日（暂以 `orders.created_at` 近似）计为第 1 天，共 7 个自然日，保修截止日 = 交付日 + 6 天；`in_warranty = 写入时刻 ≤ 保修截止日` | 是否在保修期内（**仅提示**） | — | C2 / §7.4 |
| 5 | `description` | `VARCHAR(600)` | 否 | — | ≤300 字 | 问题描述 | — | C3 |
| 6 | `media` | `TEXT[]` | 是 | — | 长度 ≤3；元素以 `/uploads/` 开头 | 问题照片 | — | C4 |
| 7 | `status` | `VARCHAR(16)` | 否 | `'pending'` | `pending`/`processing`/`closed` | 售后状态 | — | §7.3 |
| 8 | `remark` | `VARCHAR(500)` | 是 | — | ≤500 字 | 店主备注（处理结论） | — | §7.3 |
| 9 | `notify_status` | `VARCHAR(16)` | 否 | `'pending'` | 同 `orders.notify_status` | 通知结果 | — | 技术补充 |
| 10 | `created_at` | `TIMESTAMPTZ(3)` | 否 | `now()` | — | 提交时间 | ✔ | §8 |
| 11 | `updated_at` | `TIMESTAMPTZ(3)` | 否 | `now()` | 应用层写入 | 更新时间 | — | §8 |

**索引**：`idx_aftersales_phone` (`phone`)、`idx_aftersales_created` (`created_at` DESC)、`idx_aftersales_order` (`order_id`)。

> ⚠️ `in_warranty` 是**写入时快照**，不是实时计算值：展示时以快照为准，最终判断权归店主（PRD C2 明确「仅提示」）。若店主修改关联订单，需在后台触发重算。
>
> **保修口径**：交付日暂以订单创建日（`orders.created_at`）近似；交付日计为第 1 天，共 7 个自然日；保修截止日 = 交付日 + 6 天；`in_warranty` 即「写入时刻是否未超过保修截止日」。本字段与 API 契约 §3.3 的 `inWarranty` / `warrantyEndDate` 使用**同一算法（单一函数）**，避免两处口径漂移。

### 3.3 `admin_users` — 后台账号

| # | 字段 | 类型 | 可空 | 默认 | 取值域 / 约束 | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `INT` | 否 | IDENTITY | 主键 | — |
| 2 | `username` | `VARCHAR(32)` | 否 | — | 唯一，3–32 字 | 登录名 |
| 3 | `password_hash` | `VARCHAR(100)` | 否 | — | bcrypt 哈希（cost 10）；**禁止任何形式明文** | 密码 |
| 4 | `created_at` | `TIMESTAMPTZ(3)` | 否 | `now()` | — | 创建时间 |
| 5 | `last_login_at` | `TIMESTAMPTZ(3)` | 是 | — | 登录成功时更新 | 最近登录（异常排查） |

> 单店场景仅 1 个账号；表结构保留多账号能力，不引入角色/权限表（PRD §3.2 明确不做多角色）。

### 3.4 `notification_logs` — 通知日志

| # | 字段 | 类型 | 可空 | 默认 | 取值域 / 约束 | 说明 |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | `id` | `BIGINT` | 否 | IDENTITY | 主键 | — |
| 2 | `order_id` | `VARCHAR(24)` | 是 | — | 与 `aftersale_id` 至少一个非空 | 关联订单 |
| 3 | `aftersale_id` | `VARCHAR(24)` | 是 | — | 同上 | 关联售后 |
| 4 | `channel` | `VARCHAR(16)` | 否 | — | `console`/`wecom`/`serverchan` | 通知通道 |
| 5 | `status` | `VARCHAR(16)` | 否 | — | `success` / `failed` | 发送结果 |
| 6 | `payload` | `TEXT` | 是 | — | 实际发送内容（原文存档） | 漏单排查依据 |
| 7 | `error` | `VARCHAR(500)` | 是 | — | 失败原因 | 排查依据 |
| 8 | `created_at` | `TIMESTAMPTZ(3)` | 否 | `now()` | — | 发送时间 |

**索引**：`idx_notify_created` (`created_at` DESC)、`idx_notify_order` (`order_id`)、`idx_notify_aftersale` (`aftersale_id`)。其中 `idx_notify_aftersale` 为**可选索引**（售后通知排查用；数据量小可暂不建）。

**保留策略**：90 天后由运维脚本归档/清理（§10）。

---

## 4. 值域字典

| 域 | 值 | 中文含义 | 可否扩展 |
| --- | --- | --- | --- |
| `service_type` | `clean` / `other` | 清灰换硅脂 / 其他问题 | 二期可加（如 `system`） |
| `clean_tier` | `basic80` / `deep100` | 标准 ¥80 / 深度清洁 ¥100 | 价格变动只改前台文案，值不变 |
| `other_types[]` | `screen` / `wifi` / `slow` / `other` | 屏幕故障 / 网络问题 / 系统卡顿 / 其他 | 可加（需同步前台选项） |
| `contact_pref` | `phone` / `wechat` | 电话联系 / 微信联系 | 否 |
| `service_mode` | `shop` / `home` | 到店送修 / 上门服务 | 否 |
| `preferred_time` | `尽快` / `今天` / `明天` / `yyyy-MM-dd HH:mm` | 期望时间 | 否 |
| 订单 `status` | `pending` / `processing` / `done` / `aftersale` / `closed` | 待处理 / 进行中 / 已完成 / 售后 / 已关闭 | 二期可加（PRD §7.5 完整状态机） |
| 售后 `status` | `pending` / `processing` / `closed` | 待处理 / 处理中 / 已关闭 | 可加 |
| `notify_status` | `pending` / `success` / `failed` | 未发送 / 成功 / 失败 | 否 |
| `channel` | `console` / `wecom` / `serverchan` | 控制台 / 企业微信机器人 / Server 酱 | 可加（如短信） |

> 值域变更必须同步三处：本文档 §4、`src/lib/constants.ts`（TS 联合类型 + Zod 枚举）、API 契约的枚举定义。

---

## 5. 不变量（跨字段约束）

以下规则**由应用层（Zod + service 层）强制**，不依赖数据库 CHECK：

| # | 不变量 | 说明 |
| --- | --- | --- |
| I1 | `service_type='clean'` ⇒ `clean_tier` 非空 且 `other_types` 为空 | 两类服务字段互斥 |
| I2 | `service_type='other'` ⇒ `other_types` 长度 ≥1 且 `clean_tier` 为空 | 同上 |
| I3 | `phone` 匹配 `^1[3-9]\d{9}$` | 拒座机（PRD A3/C1） |
| I4 | `service_mode='home'` ⇒ 允许 `address` 非空；`shop` ⇒ `address` 必须为空 | 地址仅上门有意义 |
| I5 | `model_photos` / `media` 元素数 ≤3 且均以 `/uploads/` 开头 | 防外部 URL 注入 |
| I6 | `final_price` 为空 或 ∈ [0, 999999.99] | 金额合法 |
| I7 | 状态流转必须合法（见下表） | 防跳状态 |
| I8 | `aftersales.order_id` 非空 ⇒ 必须存在于 `orders`，且其 `phone` 与 `aftersales.phone` 一致 | 防串单 |
| I9 | `in_warranty` = 写入时刻 ≤ 保修截止日；交付日暂以 `orders.created_at` 近似，交付日计为第 1 天，共 7 个自然日，保修截止日 = 交付日 + 6 天 | 保修口径（PRD §7.4 交付日起算，当前以订单创建日近似）；与 API 契约 §3.3 的 `inWarranty` / `warrantyEndDate` 使用**同一算法（单一函数）**，禁止两处各自实现 |
| I10 | 同手机号 + 同内容 10 分钟内不重复入库；同手机号当日 ≤5 单 | PRD §5.2.4 防重防刷（下单事务前校验） |
| I11 | `description`、`remark`、`address` 等长度上限按 §3 表格执行 | DB 长度仅为宽限 |

**状态流转矩阵（订单）**

| 当前 → 目标 | pending | processing | done | aftersale | closed |
| --- | --- | --- | --- | --- | --- |
| pending | — | ✅ | ⚠️ 需备注 | ✅ | ✅ |
| processing | ✅ 回退 | — | ✅ | ✅ | ✅ |
| done | ⚠️ 需备注 | ✅ 回退 | — | ✅ | ✅ |
| aftersale | ✅ 回退 | ✅ | ✅ | — | ✅ |
| closed | ✅ 回退 | ⚠️ 需备注 | ⚠️ 需备注 | ✅ | — |

- ✅ 允许；⚠️ 允许但**必须填写 `remark`**（后台强制）；回退操作在 `remark` 中留痕。
- 非法流转返回 `40006`（见 API 契约）。

**状态流转矩阵（售后）**：`pending → processing → closed`，允许 `processing → pending` 回退。

---

## 6. 索引与查询模式对照

| 查询场景 | 使用索引 | 说明 |
| --- | --- | --- |
| 售后页输入手机号自动匹配 | `idx_orders_phone_created` | `WHERE phone = ? ORDER BY created_at DESC LIMIT 1` |
| 下单防重（10 分钟窗口） | `idx_orders_phone_created` | `WHERE phone = ? AND created_at > now() - interval '10 min'` |
| 当日限流（5 单） | `idx_orders_phone_created` | `WHERE phone = ? AND created_at >= date_trunc('day', now() AT TIME ZONE 'Asia/Shanghai')` |
| 后台列表（默认） | `idx_orders_status_created` | `ORDER BY created_at DESC LIMIT/OFFSET` |
| 后台按状态筛选 | `idx_orders_status_created` | 前缀列 `status` |
| 后台按手机号搜索 | `idx_orders_phone_created` | 精确匹配（前缀列 `phone`） |
| 导出（按时间范围） | `idx_orders_created` | `WHERE created_at BETWEEN ? AND ?` |
| 通知失败订单标红 | `orders.notify_status` 过滤 | 数据量小，全表过滤可接受；若变慢再加部分索引 `WHERE notify_status='failed'` |

> 量级预期：日均个位数订单、年累计 <5000 行，索引以「够用」为准，不做过早优化。

---

## 7. 单号生成契约

| 项 | 约定 |
| --- | --- |
| 格式 | 订单 `R` + `yyyyMMdd`（Asia/Shanghai）+ `-` + 3 位流水；售后同规则，前缀 `A` |
| 示例 | `R20261005-001`、`A20261005-001` |
| 唯一性 | 主键保证全局唯一 |
| 并发处理 | ① 统计当日已有数量 → ② 拼号 → ③ 插入；捕获主键冲突后流水 +1 重试，最多 3 次 |
| 溢出 | 当日超过 999 单时流水扩为 4 位（保持唯一，前端不解析位数） |
| 前端约束 | 单号仅作为字符串展示与复制，**不得做数学运算或位数解析** |

---

## 8. 事务边界

| 场景 | 事务范围 | 回滚条件 |
| --- | --- | --- |
| 下单 | ① 防重/限流校验（只读）→ ② `INSERT orders` → ③ `INSERT notification_logs` + `UPDATE orders.notify_status` | ① 命中防重或限流：不入库直接返回错误码；通知失败**不回滚订单**（降级为 failed 状态） |
| 售后提交 | ① 匹配订单（只读）→ ② 计算 `in_warranty` → ③ `INSERT aftersales` → ④ 通知与日志 | 同上 |
| 后台改状态/备注 | ① 校验流转合法 → ② `UPDATE orders SET status, remark, updated_at` | 非法流转直接返回 40006，不写库 |
| 导出 | 只读，无事务 | — |

> **通知不进主事务的关键理由**：客户下单成功是主诉求，通知失败不能导致客户白填一次表单（PRD 要求「任何情况下不清空已填内容、不阻断提交」）。

---

## 9. 迁移与版本管理

| 阶段 | 做法 |
| --- | --- |
| 开发期 | `pnpm db:push`（即 `prisma db push`，快速同步，不生成迁移文件） |
| 上线前 | 切换到版本化迁移：`pnpm db:migrate`（即 `prisma migrate dev`，开发生成）/ `pnpm db:migrate deploy`（即 `prisma migrate deploy`，生产执行） |
| 生产环境 | **只允许 `prisma migrate deploy`**；**禁止 `db push`**（禁止用 `prisma db push` 同步生产结构） |
| 迁移文件命名 | `prisma/migrations/20261005_add_notify_status/migration.sql`（时间戳 + 语义化描述） |
| 生产执行人 | 仅运维/开发负责人；执行前必须 `pg_dump` 备份（§10） |
| 回滚策略 | 迁移文件内**必须**包含等价回滚说明（注释形式）；破坏性变更禁止直接 `DROP` |
| 破坏性变更流程 | 三步走：① 新增可空列 → ② 应用双写 → ③ 数据回填确认后再删除旧列（至少跨一个版本） |
| 禁止事项 | 生产环境禁止 `prisma db push`、禁止手工改表、禁止无迁移的结构变更 |

---

## 10. 数据生命周期、备份与合规

| 项 | 约定 |
| --- | --- |
| 订单 / 售后数据 | 保留 ≥2 年（记账与售后追溯）；不做物理删除 |
| 通知日志 | 保留 90 天，之后归档清理 |
| 上传照片 | 保留 90 天；到期由运维脚本清理 `storage/uploads` 中对应用户上传文件（占位图与素材除外） |
| 备份 | PostgreSQL 每日 `pg_dump -Fc` 至对象存储，保留 14 天；云数据库开启自动备份 + PITR |
| 恢复演练 | 上线后 1 个月内做一次「备份还原到独立实例」演练，确认可用 |
| 个人信息 | `phone` 属个人信息：仅后台（需登录）与通知消息中出现；**公开接口不得返回**（成功页摘要接口做脱敏） |
| 客户要求删除 | 支持将 `orders.phone` / `aftersales.phone` 置为掩码（如 `138****0000`）并清空 `address`，保留单号与统计；操作需在 `remark` 留痕 |
| 导出管控 | CSV 导出仅限已登录后台，含手机号，下载后由店主自行保管；建议每季度清理本地导出文件 |
| 审计 | `notification_logs` 兼作通知审计；订单/售后的状态与备注变更由 `updated_at` + `remark` 留痕（V1 不做独立审计表） |

---

## 11. 种子数据契约

`pnpm db:seed` 必须**幂等**（重复执行不产生重复数据）。种子脚本按 `SEED_MODE` 拆分为两种模式：

| 模式 | 适用环境 | 内容 |
| --- | --- | --- |
| `SEED_MODE=demo` | 本地 / 预发 | 创建管理员 + 演示订单与演示售后（见下表） |
| `SEED_MODE=admin` | 生产 | **仅创建管理员**，不写入任何演示订单/售后 |

- 生产默认 `SEED_MODE=admin`（**未显式设置时按 `admin` 处理，作为生产安全默认**）；**演示数据不得进入生产**。
- 本地开发通过 `.env.example` 显式提供 `SEED_MODE=demo`（复制为 `.env` 即生效），因此本地不需额外设置即为 demo 模式。
- 两种模式都必须幂等（下表 `upsert` 方式不变）。

**演示数据（仅 `SEED_MODE=demo`）**

| 数据 | 内容 | 幂等方式 |
| --- | --- | --- |
| 管理员 | `admin`（密码来自 `hash-password`） | `upsert` by `username` |
| 演示订单 1 | `R20261005-001`：清灰换硅脂·深度清洁 ¥100、上门、微信联系、`pending`、2 张占位照片（`/uploads/seed/model-01.jpg`、`/uploads/seed/model-02.jpg`） | `upsert` by `id` |
| 演示订单 2 | `R20261004-001`：其他问题·屏幕故障、到店、电话联系、`done` | `upsert` by `id` |
| 演示售后 | `A20261005-001`：关联演示订单 1，`in_warranty = true`，`pending` | `upsert` by `id` |

> 演示照片路径必须以 `/uploads/` 开头（符合 §5 I5 不变量）；生产环境不执行 `demo` 模式，仅执行 `SEED_MODE=admin`。

---

## 12. DDL（PostgreSQL 16）

```sql
-- 由 Prisma migrate 生成时结构一致；以下为权威参考
CREATE TABLE admin_users (
  id            INT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  username      VARCHAR(32)   NOT NULL UNIQUE,
  password_hash VARCHAR(100)  NOT NULL,
  created_at    TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ(3) NULL
);

CREATE TABLE orders (
  id             VARCHAR(24)   PRIMARY KEY,
  service_type   VARCHAR(16)   NOT NULL,                 -- clean | other
  clean_tier     VARCHAR(16)   NULL,                     -- basic80 | deep100
  other_types    TEXT[]        NULL,                     -- {screen,wifi,slow,other}
  contact_name   VARCHAR(40)   NOT NULL,
  phone          VARCHAR(11)   NOT NULL,                 -- 仅手机号
  contact_pref   VARCHAR(16)   NOT NULL,                 -- phone | wechat
  brand_model    VARCHAR(100)  NOT NULL,
  model_photos   TEXT[]        NULL,
  description    VARCHAR(600)  NULL,
  service_mode   VARCHAR(16)   NOT NULL,                 -- shop | home
  preferred_time VARCHAR(64)   NULL,
  address        VARCHAR(200)  NULL,
  status         VARCHAR(16)   NOT NULL DEFAULT 'pending',
  final_price    NUMERIC(10,2) NULL,
  remark         VARCHAR(500)  NULL,
  notify_status  VARCHAR(16)   NOT NULL DEFAULT 'pending',
  created_at     TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ(3) NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_phone_created  ON orders (phone, created_at DESC);
CREATE INDEX idx_orders_status_created ON orders (status, created_at DESC);
CREATE INDEX idx_orders_created        ON orders (created_at DESC);
-- 注意：Prisma 无法声明 GIN 索引，idx_orders_other_types 需在迁移 SQL 中手工添加；若不使用问题类型筛选可暂不创建
CREATE INDEX idx_orders_other_types    ON orders USING GIN (other_types);

CREATE TABLE aftersales (
  id            VARCHAR(24)   PRIMARY KEY,
  phone         VARCHAR(11)   NOT NULL,
  order_id      VARCHAR(24)   NULL REFERENCES orders(id),
  in_warranty   BOOLEAN       NOT NULL DEFAULT false,
  description   VARCHAR(600)  NOT NULL,
  media         TEXT[]        NULL,
  status        VARCHAR(16)   NOT NULL DEFAULT 'pending',
  remark        VARCHAR(500)  NULL,
  notify_status VARCHAR(16)   NOT NULL DEFAULT 'pending',
  created_at    TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ(3) NOT NULL DEFAULT now()
);

CREATE INDEX idx_aftersales_phone   ON aftersales (phone);
CREATE INDEX idx_aftersales_created ON aftersales (created_at DESC);
CREATE INDEX idx_aftersales_order   ON aftersales (order_id);

CREATE TABLE notification_logs (
  id           BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  order_id     VARCHAR(24)  NULL,
  aftersale_id VARCHAR(24)  NULL,
  channel      VARCHAR(16)  NOT NULL,      -- console | wecom | serverchan
  status       VARCHAR(16)  NOT NULL,      -- success | failed
  payload      TEXT         NULL,
  error        VARCHAR(500) NULL,
  created_at   TIMESTAMPTZ(3) NOT NULL DEFAULT now()
);

CREATE INDEX idx_notify_created ON notification_logs (created_at DESC);
CREATE INDEX idx_notify_order   ON notification_logs (order_id);
-- 可选索引（售后通知排查用；数据量小可暂不建）
CREATE INDEX idx_notify_aftersale ON notification_logs (aftersale_id);
```

### 12.1 可选加固（仅在手工建库/安全审计时使用）

Prisma 迁移**不会**生成 CHECK 约束，以下语句作为额外防线，需手工执行并知悉「可能与模型定义脱节」的风险：

```sql
ALTER TABLE orders ADD CONSTRAINT chk_orders_service_type CHECK (service_type IN ('clean','other'));
ALTER TABLE orders ADD CONSTRAINT chk_orders_contact_pref CHECK (contact_pref IN ('phone','wechat'));
ALTER TABLE orders ADD CONSTRAINT chk_orders_service_mode CHECK (service_mode IN ('shop','home'));
ALTER TABLE orders ADD CONSTRAINT chk_orders_status
  CHECK (status IN ('pending','processing','done','aftersale','closed'));
ALTER TABLE orders ADD CONSTRAINT chk_orders_notify_status
  CHECK (notify_status IN ('pending','success','failed'));
ALTER TABLE orders ADD CONSTRAINT chk_orders_phone CHECK (phone ~ '^1[3-9][0-9]{9}$');
ALTER TABLE orders ADD CONSTRAINT chk_orders_photos CHECK (model_photos IS NULL OR array_length(model_photos,1) <= 3);
ALTER TABLE aftersales ADD CONSTRAINT chk_aftersales_status
  CHECK (status IN ('pending','processing','closed'));
ALTER TABLE notification_logs ADD CONSTRAINT chk_notify_channel
  CHECK (channel IN ('console','wecom','serverchan'));
```

---

## 13. Prisma 模型（与 DDL 等价）

```prisma
// prisma/schema.prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
}

model Order {
  id            String    @id @db.VarChar(24)
  serviceType   String    @map("service_type") @db.VarChar(16)
  cleanTier     String?   @map("clean_tier") @db.VarChar(16)
  otherTypes    String[] @map("other_types")
  contactName   String    @map("contact_name") @db.VarChar(40)
  phone         String    @db.VarChar(11)
  contactPref   String    @map("contact_pref") @db.VarChar(16)
  brandModel    String    @map("brand_model") @db.VarChar(100)
  modelPhotos   String[] @map("model_photos")
  description   String?   @db.VarChar(600)
  serviceMode   String    @map("service_mode") @db.VarChar(16)
  preferredTime String?   @map("preferred_time") @db.VarChar(64)
  address       String?   @db.VarChar(200)
  status        String    @default("pending") @db.VarChar(16)
  finalPrice    Decimal?  @map("final_price") @db.Decimal(10, 2)
  remark        String?   @db.VarChar(500)
  notifyStatus  String    @default("pending") @map("notify_status") @db.VarChar(16)
  createdAt     DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt     DateTime  @updatedAt @map("updated_at") @db.Timestamptz(3)

  aftersales    Aftersale[]

  @@index([phone, createdAt(sort: Desc)], map: "idx_orders_phone_created")
  @@index([status, createdAt(sort: Desc)], map: "idx_orders_status_created")
  @@index([createdAt(sort: Desc)], map: "idx_orders_created")
  // 注意：Prisma 无法声明 GIN 索引；idx_orders_other_types 需在迁移 SQL 中手工添加（不使用问题类型筛选可暂不创建）
  @@map("orders")
}

model Aftersale {
  id           String   @id @db.VarChar(24)
  phone        String   @db.VarChar(11)
  orderId      String?  @map("order_id") @db.VarChar(24)
  inWarranty   Boolean  @default(false) @map("in_warranty")
  description  String   @db.VarChar(600)
  media        String[]
  status       String   @default("pending") @db.VarChar(16)
  remark       String?  @db.VarChar(500)
  notifyStatus String   @default("pending") @map("notify_status") @db.VarChar(16)
  createdAt    DateTime @default(now()) @map("created_at") @db.Timestamptz(3)
  updatedAt    DateTime @updatedAt @map("updated_at") @db.Timestamptz(3)

  order        Order?   @relation(fields: [orderId], references: [id])

  @@index([phone], map: "idx_aftersales_phone")
  @@index([createdAt(sort: Desc)], map: "idx_aftersales_created")
  @@index([orderId], map: "idx_aftersales_order")
  @@map("aftersales")
}

model AdminUser {
  id           Int       @id @default(autoincrement())
  username     String    @unique @db.VarChar(32)
  passwordHash String    @map("password_hash") @db.VarChar(100)
  createdAt    DateTime  @default(now()) @map("created_at") @db.Timestamptz(3)
  lastLoginAt  DateTime? @map("last_login_at") @db.Timestamptz(3)

  @@map("admin_users")
}

model NotificationLog {
  id          BigInt   @id @default(autoincrement())
  orderId     String?  @map("order_id") @db.VarChar(24)
  aftersaleId String?  @map("aftersale_id") @db.VarChar(24)
  channel     String   @db.VarChar(16)
  status      String   @db.VarChar(16)
  payload     String?  @db.Text
  error       String?  @db.VarChar(500)
  createdAt   DateTime @default(now()) @map("created_at") @db.Timestamptz(3)

  @@index([createdAt(sort: Desc)], map: "idx_notify_created")
  @@index([orderId], map: "idx_notify_order")
  @@map("notification_logs")
}
```

> `@@index([...], map: "...")` 中的索引名必须与 §3 表格一致，便于 DBA 对照；`@db.*` 显式声明类型，避免 Prisma 默认类型与契约漂移。

---

> ⚠️ **Prisma 语法限制（开工实测）**：Prisma 不支持可选列表（`String[]?` 会报 `Optional lists are not supported`），因此三个数组字段在 **Prisma 模型**中声明为 `String[]`（**非可选**）；在 **PostgreSQL 中这三列仍为可空 `text[]`**（§12 DDL 不变，写入 `NULL` 合法）。业务层以 `null` 表达「未上传」，前端不得依赖 Prisma 生成类型的可空性。

---

## 14. 自查清单（改表 / 上线前逐项确认）

- [ ] 字段是否已在本文档 §3 数据字典登记（含 PRD 出处）
- [ ] 新增取值是否已加入 §4 值域字典，并同步 `constants.ts`
- [ ] 是否影响 §5 不变量（跨字段规则）
- [ ] 是否影响 §6 查询模式，需要新索引
- [ ] 新字段是否有默认值（避免上线时全表锁等待）
- [ ] 迁移文件是否包含回滚说明，是否属于破坏性变更（若是，走三步走流程）
- [ ] 生产执行前是否已 `pg_dump` 备份
- [ ] 是否涉及个人信息字段（若涉及，检查 §10 合规项与接口脱敏）
- [ ] 种子脚本是否仍幂等
- [ ] API 契约与前端类型是否同步更新

---

*文档结束。数据库结构变更以本文档为准；接口字段与错误码以 `docs/api/Xiuxiu_API契约_v1.0.md` 为准。*
