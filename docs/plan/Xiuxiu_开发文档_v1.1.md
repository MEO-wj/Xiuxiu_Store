# 「xiu xiu」客户下单系统 · 开发文档（技术方案）

## 0. 文档信息

| 项目 | 内容 |
| --- | --- |
| 文档名称 | xiu xiu 客户下单系统 · 开发文档（技术方案与实施计划） |
| 版本 | v1.1（已实现；§2.2 目录树与 §10 追溯矩阵已按交付实况校正） |
| 日期 | 2026-10-05（基线）· 2026-10-23（实况校正） |
| 状态 | **已实现并交付**（实况以仓库与 `docs/plan/交付清单_v1.0.md` 为准，需求以 PRD 为准） |
| 目标读者 | 开发（前端/后端）、测试、运维、产品负责人 |
| 上游文档 | `docs/prd/Xiuxiu_PRD_v1.3.md`（需求唯一口径）、`docs/prd/Xiuxiu_UIUX_Design_v1.1.md`（视觉与交互口径） |
| 本文档职责 | 技术栈选型、架构与目录、数据库设计、接口契约、关键实现方案、本地预览、部署上线、排期与追溯 |

> **阅读顺序建议**：§1 选型结论 → §6 本地预览（想先跑起来看这个）→ §3 数据库 → §4 接口 → §5 关键实现 → §9 排期。

### 0.1 修订记录

| 版本 | 变更 |
| --- | --- |
| v1.0 | 初版：选型、架构、数据库、接口、预览、部署、排期 |
| **v1.1** | 数据库统一为 **PostgreSQL 16**（本地 Docker 与生产同引擎同大版本），取消 SQLite/MySQL 双 schema 维护；`other_types`、`model_photos`、`media` 改为 PostgreSQL 原生数组 `text[]`；时间字段统一 `TIMESTAMPTZ(3)`（库内存 UTC）；自动编号改为 `IDENTITY`；DDL、本地预览、部署备份与风险章节同步更新。**接口与数据库契约另行成册**（`docs/api/`），本文档 §3、§4 转为摘要，冲突时以契约文档为准 |
| **基线校正（T15）** | 按文档基线复核结论修正：§2.2 目录补齐接口与本地 `/uploads` 映射、§3.5 时间类型笔误、§4.1 错误码补 40006 与字段定位、§4.2 响应体对齐契约（删 `contactEta`、`lookup` 改 `orderDate`）、§4.3 补 `session` 与售后详情、§5.2 去重哈希口径与上传限流配置化、§5.3 补售后通知模板、§5.4 上传职责、§5.5 保修口径、§6.6 冒烟用例、§7.2 生产迁移与种子模式；**需求范围未变** |
| **实况校正（2026-10-23）** | §0 状态改为已实现；§2.2 目录树按交付实况标注（新增首页场景组件与样式、money 服务、验证脚本、`site/` 首页工作台组件）；§2.5 迁移步骤标记已完成；§10 REQ-01/02/03/04 行与现状对齐（首页已改版为工作台风格落地页，`Hero` 未挂载、`HERO_MODE` 保留为可选方案） |

---

## 1. 技术栈选型

### 1.1 选型结论

| 层 | 选型 | 版本 | 说明 |
| --- | --- | --- | --- |
| 全栈框架 | **Next.js（App Router）** | 15.5 LTS 线 | 一个应用同时承载 C 端页面、后台页面、REST API |
| UI 库 | **React** | 19.3 | 与 Next 15 配套 |
| 语言 | **TypeScript** | 5.9 | 前后端同一套类型；`strict: true` |
| 样式 | **Tailwind CSS** | 4.3 | 配合 UIUX 文档的 CSS 变量令牌（`--color-*`） |
| 数据访问 | **Prisma ORM** | 6.19 | 单文件模型定义，自动生成类型化 Client |
| 数据库 | **PostgreSQL 16** | 16.x | 本地与生产同引擎同大版本；本地 Docker 一键启动，生产用国内云数据库 |
| 校验 | **Zod** | 4.6 | 同一份 schema 复用于前端校验与接口入参校验 |
| 会话鉴权 | **jose（JWT）+ bcryptjs** | 6.2 / 3.0 | 后台登录：HttpOnly Cookie，密码哈希存储 |
| 图片处理 | **sharp** | 0.35 | 服务端压缩、HEIC → JPG（PRD §5.2.4 要求） |
| 消息通知 | **企业微信机器人 Webhook / Server 酱** | — | PRD §6.1 推荐方案，本地开发降级为控制台输出 |
| 运行环境 | **Node.js 22/24 + pnpm** | 24.11（本机） | pnpm 省磁盘、锁版本严格 |
| 部署 | **Docker + Nginx + HTTPS** | — | 国内服务器，需 ICP 备案（PRD §9 / REQ-16） |

### 1.2 为什么选择「Next.js 全栈」而不是「前端 + Java 后端」

项目特征：**单店、单角色、2 张主表、1 名开发者维护、无支付无派单无会员**。在这个前提下比较三种方案：

| 方案 | 可行性 | 成本 | 结论 |
| --- | --- | --- | --- |
| **A. Next.js 全栈**（React + Route Handlers + Prisma） | 完全覆盖 PRD 全部需求 | 1 个进程、1 套类型、1 次部署 | ✅ **采用** |
| B. Next.js 前端 + Spring Boot（现有 `backend/` 骨架） | 可行 | 2 个进程 + Maven/JVM + 前后端类型重复定义 + 双份部署与日志 | ❌ 对小体量项目属过度设计 |
| C. Vue + Spring Boot（原 README 骨架路线） | 可行 | 同上，且与「优先 Next.js/TS/React」的既定方向不符 | ❌ 放弃 |
| D. 纯静态页 + 云开发/低代码 | 可行 | 表单校验、售后匹配、后台导出能力受限，数据可迁移性差 | ❌ 放弃 |

**决定性理由（按权重排序）**

1. **类型贯通**：`orders` 的字段定义在 Prisma 一处声明，前端表单、接口校验、后台列表全部拿到同一类型，改字段不会漏改一侧（PRD 字段表有 A1–A10 / B1–B3 / C1–C4 共 17 个字段，人工同步成本高）。
2. **部署面小**：单容器即可上线，Nginx 只做反代与 HTTPS；备案、证书、备份都只针对一个服务。
3. **本地预览一条命令**：`pnpm db:up`（Docker 起 PostgreSQL 16）+ `pnpm dev` 即可跑通全部流程，且**本地与生产同引擎同版本**，不存在「本地能跑、上线出问题」的方言差异（本方案把「能本地预览」作为硬性验收项）。
4. **可演进但不过度设计**：二期若需要小程序，`/api/*` 已是纯 REST，可直接复用；若未来真要拆后端，Route Handler 里的 `service` 层可整层迁移。

### 1.3 明确不引入的技术（避免过度设计）

| 不引入 | 原因 |
| --- | --- |
| Redis | 限流与去重用「数据库查询 + 唯一索引」即可满足每日 5 单 / 10 分钟去重的量级 |
| 消息队列（MQ） | 通知是同步一次 Webhook 调用，失败落库重试即可 |
| 微服务 / 多模块拆分 | 单店 2 表，拆分只增加运维负担 |
| 状态管理库（Redux/Zustand） | 页面级状态用 React 原生 hooks 足够 |
| 组件库（Ant Design / MUI） | UIUX 明确 iOS 风格且需自定义令牌，直接 Tailwind + 自建组件更贴合 |
| 国际化 i18n | 单店单语言 |
| 完整 CI/CD 链路 | 初期用「本地构建 + 服务器拉取重启」脚本；CI 待稳定后再加 |

---

## 2. 系统架构

### 2.1 架构图

```
                     微信内置浏览器 / 手机浏览器
                               │  HTTPS
                               ▼
                    ┌──────────────────────┐
                    │   Nginx（443）        │  静态资源缓存 / 反代 / 证书
                    └──────────┬───────────┘
                               ▼
               ┌────────────────────────────────────┐
               │   Next.js 应用（单进程，Node 24）    │
               │                                    │
               │  ┌──────────────┐ ┌─────────────┐  │
               │  │ C 端页面      │ │ 后台页面     │  │
               │  │ / /order     │ │ /admin/*    │  │
               │  │ /success     │ │ (Cookie 会话)│  │
               │  │ /aftersale   │ │             │  │
               │  └──────┬───────┘ └──────┬──────┘  │
               │         │   Server       │         │
               │         ▼   Components   ▼         │
               │  ┌──────────────────────────────┐  │
               │  │  /api/*  Route Handlers      │  │
               │  │  （统一响应体 + 错误码 + Zod） │  │
               │  └──────────────┬───────────────┘  │
               │                 ▼                  │
               │  ┌──────────────────────────────┐  │
               │  │  src/server（业务层）         │  │
               │  │  校验 / 单号 / 防重限流 /      │  │
               │  │  保修判断 / 导出 / 通知        │  │
               │  └───────┬──────────────┬───────┘  │
               └──────────┼──────────────┼──────────┘
                          ▼              ▼
                 ┌────────────────┐  ┌──────────────────┐
                 │ Prisma → DB    │  │ 通知通道          │
                 │ PostgreSQL 16  │  │ 企微机器人 /      │
                 │（本地/生产同） │  │ Server 酱         │
                 └────────────────┘  └──────────────────┘
                          │
                 ┌────────────────┐
                 │ storage/uploads│  上传照片（本地磁盘；生产可换对象存储）
                 └────────────────┘
```

### 2.2 目录规划（交付实况）

> 下图为**当前仓库实况**（已实现）；与本节的旧版目标结构差异：首页已迭代为工作台风格落地页，新增首页场景组件与三个页面级样式文件；`Hero` 组件保留但未挂载（`HERO_MODE` 可选方案）。`/uploads` 访问由 Route Handler 实现（见下方说明）。

```text
XiuXiu_Store/
├── package.json / tsconfig.json / next.config.ts / postcss.config.mjs
├── .env.example                 # 环境变量模板（真实 .env 不入库）
├── prisma/
│   ├── schema.prisma            # PostgreSQL 数据模型（四模型，与数据库契约 §13 一致）
│   ├── seed.ts                  # 幂等种子（SEED_MODE=demo|admin）
│   └── README.md                # 迁移规则与常用命令
├── scripts/
│   ├── hash-password.ts         # 生成后台密码哈希
│   ├── make-placeholders.mjs    # 生成占位素材（幂等）
│   ├── verify-core.ts           # 核心业务规则自测（132 项断言 + 连库冒烟）
│   ├── verify-fixes.ts          # review 修复回归（22 项）
│   ├── smoke-api.mjs            # 契约冒烟（44 项断言）
│   └── run-smoke.ps1            # 一键冒烟：清端口 → start → 冒烟 → 清理
├── src/
│   ├── app/
│   │   ├── (site)/              # C 端路由组【PRD §4】
│   │   │   ├── page.tsx                 # /            工作台风格首页【REQ-01，已改版】
│   │   │   ├── order/page.tsx           # /order       两步下单主页【REQ-02~09,17】
│   │   │   ├── success/page.tsx         # /success     提交成功页【REQ-09】
│   │   │   └── aftersale/
│   │   │       ├── page.tsx             # /aftersale   售后报修【REQ-10】
│   │   │       └── success/page.tsx     # /aftersale/success
│   │   ├── admin/               # 后台【PRD §6.2】
│   │   │   ├── layout.tsx
│   │   │   ├── login/page.tsx
│   │   │   ├── orders/page.tsx          # 列表
│   │   │   ├── orders/[id]/page.tsx     # 详情 / 改状态 / 备注
│   │   │   └── aftersales/page.tsx
│   │   ├── api/                 # REST 接口【§4】
│   │   │   ├── orders/route.ts             # POST 下单
│   │   │   ├── orders/[id]/route.ts        # GET 成功页脱敏摘要（不含 status/手机号）
│   │   │   ├── aftersales/route.ts         # POST 售后报修
│   │   │   ├── aftersales/lookup/route.ts  # GET 按手机号匹配订单
│   │   │   ├── upload/route.ts             # POST 图片上传
│   │   │   └── admin/
│   │   │       ├── {login,logout,session}/route.ts
│   │   │       ├── orders/route.ts + orders/[id]/route.ts
│   │   │       ├── aftersales/route.ts + aftersales/[id]/route.ts
│   │   │       ├── export/route.ts
│   │   │       └── stats/route.ts
│   │   ├── uploads/[...path]/route.ts  # /uploads/* 本地图片读取（含路径穿越防护）
│   │   ├── globals.css          # UIUX 设计令牌 + 断点令牌（§3.4 of UIUX；断点见实施约定 §1）
│   │   ├── site.css / home-motion.css / mobile-home.css  # 首页工作台样式与装饰动效
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ui/                  # Button / Field / Segmented / Chip / Notice / QrCard / Skeleton / Toast / Spinner / BottomBar
│   │   ├── site/                # 首页工作台（SiteHeader / HomeExperience / HomeAtmosphere / RepairScene / WorkbenchProps / MobileHome / ServiceIcon）
│   │   │                        # 与业务组件（NavBar / Hero* / BottomSheet / PreferredTimeSheet / PhotoUploader / SiteFooter / icons / keyframes）
│   │   └── admin/               # StatusBadge、AdminNav
│   ├── lib/
│   │   ├── types.ts             # 订单/售后领域类型（与 Prisma 生成类型对齐）
│   │   ├── validation.ts        # Zod schema（与 PRD 字段表一一对应）
│   │   ├── constants.ts         # 状态、服务类型、文案常量
│   │   ├── format.ts            # 单号/时间/金额格式化
│   │   └── response.ts          # 统一响应体封装
│   ├── server/
│   │   ├── db.ts                # Prisma 单例
│   │   ├── order-service.ts     # 下单、去重、限流、单号
│   │   ├── aftersale-service.ts # 售后、订单匹配、保修判断
│   │   ├── notify.ts            # 企微 / Server 酱 / console 降级
│   │   ├── auth.ts              # 后台会话（jose + bcryptjs）
│   │   ├── upload.ts            # sharp 压缩与 HEIC 转 JPG
│   │   ├── export.ts            # CSV 导出（带 BOM）
│   │   └── money.ts             # 金额换算（分→元，避免浮点误差）
│   └── middleware.ts            # /admin/* 未登录重定向
├── public/
│   ├── wechat-qr.png            # 占位图，上线前替换（PRD §12.2）
│   └── sample-model-label.jpg   # 占位图，上线前替换
├── storage/uploads/             # 用户上传（不入库 git）
├── deploy/
│   └── docker/docker-compose.yml   # 本地 PostgreSQL 16
└── docs/{prd,plan,api}
```

> **上传图片的访问方式（开工实测后修正）**：`/uploads/:path*` 由 **Route Handler** `src/app/uploads/[...path]/route.ts` 从 `storage/uploads/` 读取并返回（含路径穿越防护与长缓存头）。
> 原方案用 `next.config.ts` 的 `rewrites` 指向 `/storage/uploads/:path*`，但 `rewrites` 的 destination 是 **URL 路径**而非文件系统路径，而 `storage/` 不在 `public/` 下，实测返回 404；故改用 Route Handler（本地与生产均可，生产亦可由 Nginx 直出同目录）。

### 2.3 分层约定

| 层 | 位置 | 职责 | 禁止 |
| --- | --- | --- | --- |
| 页面层 | `src/app/**/page.tsx` | 渲染、表单交互、调用 API | 不直连数据库 |
| 接口层 | `src/app/api/**/route.ts` | 入参解析（Zod）、鉴权、调 service、包统一响应体 | 不写业务规则 |
| 业务层 | `src/server/*-service.ts` | 全部业务规则（去重、限流、保修、单号） | 不感知 HTTP |
| 数据层 | `src/server/db.ts` + `prisma/` | 数据读写 | 不写业务分支 |

> 好处：PRD 的每条业务规则都能在 `src/server` 找到唯一实现点，测试与评审只需看这一层。

### 2.4 环境划分

| 环境 | 数据库 | 通知 | 用途 |
| --- | --- | --- | --- |
| 本地（dev） | PostgreSQL 16（Docker 容器 `xiuxiu-pg`，端口 5432） | `NOTIFY_PROVIDER=console`（打进终端） | 开发与预览 |
| 预发（可选） | 云 PostgreSQL 16 测试库 | 企微测试群 | 真机走查 |
| 生产（prod） | 云 PostgreSQL 16（阿里云 RDS / 腾讯云 PostgreSQL，或自建同版本） | 企微正式群 / Server 酱 | 对外 |

### 2.5 迁移步骤（已完成，历史记录）

```bash
# 1. 移除被取代的骨架（当前均为 .gitkeep 空目录）
git rm -r frontend/web frontend/admin-web backend
# 2. 建立 Next.js 全栈骨架（§2.2）
# 3. 更新 README 的目录结构与运行说明
```

> ✅ 该步骤已执行：仓库现为 Next.js 全栈单应用，`frontend/`、`backend/` 已移除，目录见 §2.2 实况。

---

## 3. 数据库设计（摘要）

> **完整契约见 `docs/api/Xiuxiu_数据库契约_v1.0.md`**：数据字典、值域、不变量、索引与查询模式、单号契约、事务边界、迁移规则、数据生命周期、完整 DDL 与 Prisma 模型。本章仅保留设计摘要，**两者冲突时以契约文档为准**。

### 3.1 ER 关系

```
admin_users                       orders
┌──────────────┐                 ┌──────────────────────┐
│ id           │                 │ id (PK 单号 R…)       │
│ username  UQ │                 │ phone ───────────────┼──┐
│ password_hash│                 │ service_type          │  │ 手机号为业务主键
└──────────────┘                 │ clean_tier            │  │（客户免登录，PRD §7）
                                 │ contact_pref          │  │
notification_logs                │ service_mode          │  │
┌──────────────┐                 │ status                │  │
│ id           │                 │ final_price / remark  │  │
│ order_id ────┼────────────────►│ created_at            │  │
│ aftersale_id ┼───┐             └───────────┬──────────┘  │
│ channel      │   │                         │ 1           │
│ status/error │   │                         │ 0..1        │
└──────────────┘   │             aftersales  ▼              │
                   └────────────►┌──────────────────────┐   │
                                 │ id (PK 单号 A…)       │   │
                                 │ phone ────────────────┼───┘
                                 │ order_id (可空,自动匹配)│
                                 │ in_warranty (0/1)     │
                                 │ status                │
                                 │ created_at            │
                                 └──────────────────────┘
```

### 3.2 表：`orders`（订单，PRD §8）

| 字段 | 类型 | 约束 | 说明 / PRD 出处 |
| --- | --- | --- | --- |
| `id` | VARCHAR(24) | PK | 单号 `R` + `yyyyMMdd` + 3 位流水，如 `R20261005-001` |
| `service_type` | VARCHAR(16) | NOT NULL | `clean`（清灰换硅脂）/ `other`（其他问题）[REQ-05] |
| `clean_tier` | VARCHAR(16) | NULL | `basic80` / `deep100`；`service_type=clean` 时必填 [REQ-06 A1] |
| `other_types` | TEXT[] | NULL | 多选问题类型数组：`{screen,wifi,slow,other}` [REQ-07 B1]（PostgreSQL 原生数组，Prisma `String[]`） |
| `contact_name` | VARCHAR(40) | NOT NULL | 联系人，1–20 字 [A2] |
| `phone` | VARCHAR(11) | NOT NULL | **仅手机号**，`^1[3-9]\d{9}$` [A3] |
| `contact_pref` | VARCHAR(16) | NOT NULL | `phone` / `wechat` [A7 / REQ-17] |
| `brand_model` | VARCHAR(100) | NOT NULL | 品牌/型号，1–50 字 [A4] |
| `model_photos` | TEXT[] | NULL | 图片 URL 数组，最多 3 张 [A5 / REQ-08] |
| `description` | VARCHAR(600) | NULL | 故障描述，≤300 字 [A6] |
| `service_mode` | VARCHAR(16) | NOT NULL | `shop`（到店）/ `home`（上门）[A8 / §7.1] |
| `preferred_time` | VARCHAR(64) | NULL | 尽快 / 今天 / 明天 / `2026-10-06 14:00` [A9] |
| `address` | VARCHAR(200) | NULL | 上门地址，选填，≤100 字 [A10] |
| `status` | VARCHAR(16) | NOT NULL | `pending` / `processing` / `done` / `aftersale` / `closed` [§7.5] |
| `final_price` | DECIMAL(10,2) | NULL | 店主沟通确认后回填（含上门加价） |
| `remark` | VARCHAR(500) | NULL | 店主备注 |
| `notify_status` | VARCHAR(16) | NOT NULL DEFAULT 'pending' | 通知结果：`pending`/`success`/`failed`（新增，用于通知失败兜底） |
| `created_at` | TIMESTAMPTZ(3) | NOT NULL | 下单时间（去重与限流依据；库内存 UTC） |
| `updated_at` | TIMESTAMPTZ(3) | NOT NULL | 更新时间 |

**索引**

| 索引 | 字段 | 用途 |
| --- | --- | --- |
| `idx_orders_phone_created` | (`phone`, `created_at`) | 售后匹配最近一单；同手机号 10 分钟去重；当日 5 单限流 |
| `idx_orders_status_created` | (`status`, `created_at`) | 后台按状态筛选、按时间倒序列表 |
| `idx_orders_created` | (`created_at`) | 导出与统计 |

### 3.3 表：`aftersales`（售后，PRD §8）

| 字段 | 类型 | 约束 | 说明 / PRD 出处 |
| --- | --- | --- | --- |
| `id` | VARCHAR(24) | PK | 售后单号 `A` + `yyyyMMdd` + 3 位流水 |
| `phone` | VARCHAR(11) | NOT NULL | 仅手机号 [C1] |
| `order_id` | VARCHAR(24) | NULL, FK→orders.id | 自动匹配到的原订单，可空 [C2] |
| `in_warranty` | BOOLEAN | NOT NULL DEFAULT false | 是否在 7 天保修期内（**仅提示**，最终由店主判断）[C2 / §7.4] |
| `description` | VARCHAR(600) | NOT NULL | 问题描述，≤300 字 [C3] |
| `media` | TEXT[] | NULL | 图片 URL 数组，最多 3 张 [C4] |
| `status` | VARCHAR(16) | NOT NULL | `pending` / `processing` / `closed` |
| `remark` | VARCHAR(500) | NULL | 店主备注 |
| `notify_status` | VARCHAR(16) | NOT NULL DEFAULT 'pending' | 通知结果 |
| `created_at` / `updated_at` | TIMESTAMPTZ(3) | NOT NULL | 库内存 UTC |

**索引**：`idx_aftersales_phone` (`phone`)、`idx_aftersales_created` (`created_at`)。

### 3.4 表：`admin_users`（后台账号）

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `id` | INT GENERATED BY DEFAULT AS IDENTITY | PK | PostgreSQL 自增（Prisma `Int @id @default(autoincrement())`） |
| `username` | VARCHAR(32) | UNIQUE, NOT NULL | 登录名 |
| `password_hash` | VARCHAR(100) | NOT NULL | bcrypt 哈希（**严禁明文**） |
| `created_at` | TIMESTAMPTZ(3) | NOT NULL | — |
| `last_login_at` | TIMESTAMPTZ(3) | NULL | 最近登录时间 |

> PRD 说明后台登录方案「由开发方自行设计」[REQ-13]，本方案采用「单账号 + bcrypt + HttpOnly Cookie 会话」。

### 3.5 表：`notification_logs`（通知日志，新增）

| 字段 | 类型 | 约束 | 说明 |
| --- | --- | --- | --- |
| `id` | BIGINT GENERATED BY DEFAULT AS IDENTITY | PK | PostgreSQL 自增 |
| `order_id` | VARCHAR(24) | NULL | 关联订单 |
| `aftersale_id` | VARCHAR(24) | NULL | 关联售后 |
| `channel` | VARCHAR(16) | NOT NULL | `console` / `wecom` / `serverchan` |
| `status` | VARCHAR(16) | NOT NULL | `success` / `failed` |
| `payload` | TEXT | NULL | 发送内容（便于排查漏单） |
| `error` | VARCHAR(500) | NULL | 失败原因 |
| `created_at` | TIMESTAMPTZ(3) | NOT NULL | — |

> 新增理由：微信通知是**唯一**的接单渠道，一旦静默失败就等同漏单。落库后后台可标红未成功通知的订单（对应风险 R3）。

### 3.6 单号生成规则与并发安全

```
订单：R + yyyyMMdd + '-' + 3 位流水    例：R20261005-001
售后：A + yyyyMMdd + '-' + 3 位流水    例：A20261005-001
```

生成逻辑（避免并发重复）：

1. 取当日已有单数：`SELECT COUNT(*) FROM orders WHERE id LIKE 'R20261005-%'`；
2. 流水号 = 计数 + 1，补零到 3 位；
3. 插入时依赖主键冲突兜底：捕获唯一键冲突后重试（最多 3 次，每次 +1）。

> 单店量级（日均个位数订单）下无需号段表；PostgreSQL 下如需更严格的并发安全，可改用 `pg_advisory_xact_lock` 或号段表，当前依赖主键冲突重试已足够。

### 3.7 状态与枚举（应用层字符串，不用数据库 ENUM）

| 域 | 取值 | 出处 |
| --- | --- | --- |
| 订单状态 | `pending` 待处理 / `processing` 进行中 / `done` 已完成 / `aftersale` 售后 / `closed` 已关闭 | PRD §7.5（MVP 五态） |
| 售后状态 | `pending` / `processing` / `closed` | PRD §7.3 |
| 服务类型 | `clean` / `other` | PRD §5.2.4 |
| 套餐 | `basic80` / `deep100` | PRD §5.2.4 |
| 联系偏好 | `phone` / `wechat` | PRD §5.2.4 A7 |
| 服务方式 | `shop` / `home` | PRD §5.2.4 A8 |

**统一用字符串而非数据库 ENUM 的原因**：状态字段后续可能增删（如二期新增「已派单」），用字符串可避免每次改枚举都写数据库迁移；取值由 `src/lib/constants.ts` 的 TS 联合类型 + Zod 枚举约束，保证类型安全。

### 3.8 本地与生产的数据库一致性

本地与生产**使用同一引擎、同一大版本（PostgreSQL 16）**，因此只需一份 `prisma/schema.prisma`，不存在双 schema 维护问题。

| 项 | 约定 |
| --- | --- |
| 版本 | 本地 Docker 镜像 `postgres:16`；生产使用云 PostgreSQL 16（或自建同版本） |
| 连接串 | `DATABASE_URL=postgresql://xiuxiu:xiuxiu@localhost:5432/xiuxiu?schema=public&connection_limit=5`（生产加 `sslmode=require`） |
| 字符集 / 排序 | 建库使用 `UTF8`；排序规则可用 `zh_CN.UTF-8` 或默认（本项目手机号/单号都是精确匹配，对 collation 不敏感） |
| 时区 | 字段统一 `TIMESTAMPTZ(3)`，**库内存 UTC**；展示与营业时间判断统一按 `Asia/Shanghai` 格式化 |
| 数组类型 | `other_types` / `model_photos` / `media` 用原生 `text[]`（Prisma `String[]`），避免逗号拼接的转义与查询不便 |
| 自增主键 | 使用 `IDENTITY`（Prisma `autoincrement()`） |
| 迁移策略 | 开发期用 `prisma db push` 快速同步；上线前改为版本化迁移 `prisma migrate deploy`（迁移文件入库，便于回溯） |

**建表与运维命令**

```bash
pnpm db:up          # docker compose 启动本地 PostgreSQL 16
pnpm db:push        # = prisma db push（本地/生产同一份 schema）
pnpm db:migrate     # 需要版本化迁移时使用（开发）
pnpm db:seed        # 初始化管理员与演示数据
pnpm db:studio      # 可视化查看数据
```

> 无 Docker 时可改用本机安装的 PostgreSQL 16，或直接指向云端测试实例，**只需修改 `DATABASE_URL`**。

### 3.9 建表 DDL（PostgreSQL 16，可直接执行）

```sql
-- PostgreSQL 16
CREATE TABLE admin_users (
  id            INT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  username      VARCHAR(32)   NOT NULL UNIQUE,
  password_hash VARCHAR(100)  NOT NULL,
  created_at    TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  last_login_at TIMESTAMPTZ(3) NULL
);

CREATE TABLE orders (
  id             VARCHAR(24)   PRIMARY KEY,
  service_type   VARCHAR(16)   NOT NULL,               -- clean | other
  clean_tier     VARCHAR(16)   NULL,                   -- basic80 | deep100
  other_types    TEXT[]        NULL,                   -- {screen,wifi,slow,other}
  contact_name   VARCHAR(40)   NOT NULL,
  phone          VARCHAR(11)   NOT NULL,               -- 仅手机号
  contact_pref   VARCHAR(16)   NOT NULL,               -- phone | wechat
  brand_model    VARCHAR(100)  NOT NULL,
  model_photos   TEXT[]        NULL,
  description    VARCHAR(600)  NULL,
  service_mode   VARCHAR(16)   NOT NULL,               -- shop | home
  preferred_time VARCHAR(64)   NULL,
  address        VARCHAR(200)  NULL,
  status         VARCHAR(16)   NOT NULL DEFAULT 'pending',
  final_price    NUMERIC(10,2) NULL,
  remark         VARCHAR(500)  NULL,
  notify_status  VARCHAR(16)   NOT NULL DEFAULT 'pending',
  created_at     TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ(3) NOT NULL DEFAULT now()
);

CREATE INDEX idx_orders_phone_created  ON orders (phone, created_at);
CREATE INDEX idx_orders_status_created ON orders (status, created_at);
CREATE INDEX idx_orders_created        ON orders (created_at);
CREATE INDEX idx_orders_other_types    ON orders USING GIN (other_types);   -- 可选：按问题类型筛选

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
CREATE INDEX idx_aftersales_created ON aftersales (created_at);

CREATE TABLE notification_logs (
  id           BIGINT GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
  order_id     VARCHAR(24)  NULL,
  aftersale_id VARCHAR(24)  NULL,
  channel      VARCHAR(16)  NOT NULL,
  status       VARCHAR(16)  NOT NULL,
  payload      TEXT         NULL,
  error        VARCHAR(500) NULL,
  created_at   TIMESTAMPTZ(3) NOT NULL DEFAULT now()
);

CREATE INDEX idx_notify_created ON notification_logs (created_at);
CREATE INDEX idx_notify_order   ON notification_logs (order_id);
```

---

## 4. 接口契约（摘要）

> **完整契约见 `docs/api/Xiuxiu_API契约_v1.0.md`**（字段级校验、错误码、时序图、前端提示规范、冒烟脚本）与 **`docs/api/openapi.yaml`**（机器可读规格，可导入 Postman / Swagger UI）。本章仅保留摘要，**两者冲突时以契约文档为准**。

### 4.1 统一响应体与错误码

```jsonc
// 成功
{ "code": 0, "message": "ok", "data": { /* ... */ } }
// 失败
{ "code": 40001, "message": "请填写正确的 11 位手机号", "data": null }
```

| 错误码 | HTTP | 含义 | 触发场景 |
| --- | --- | --- | --- |
| `0` | 200 | 成功 | — |
| `40001` | 400 | 参数校验失败 | Zod 校验不通过（**message 直接用于前端提示**） |
| `40002` | 400 | 手机号格式错误 | 非 11 位 / 非 `1[3-9]` 开头（含座机） |
| `40003` | 409 | 重复提交 | 同手机号 + 同内容 10 分钟内重复 |
| `40004` | 429 | 提交过于频繁 | 同手机号当日超过 5 单 |
| `40005` | 400 | 上传文件不合法 | 类型不支持 / 单张超 5MB（**总张数由前端限制，服务端不校验**） |
| `40006` | 400 | 当前状态不允许此操作 | 非法状态流转，或命中「需备注」的流转但 `remark` 为空 |
| `40100` | 401 | 未登录或会话过期 | 后台接口 |
| `40400` | 404 | 资源不存在 | 后台按单号查不到 |
| `50000` | 500 | 服务器异常 | 兜底（前端提示「请重试或拨打 18029516310」） |

> **字段定位**：失败响应的 `data` 携带 `{ "field": "phone", "fields": [{ "field", "message" }] }`，前端据此定位到具体字段；成功响应的 `data` 仍为业务数据。完整错误码与文案见 API 契约 §1.4/§7。

### 4.2 C 端接口

#### POST `/api/orders` — 提交订单 [REQ-09]

请求体：

```jsonc
{
  "serviceType": "clean",              // clean | other
  "cleanTier": "basic80",              // clean 必填：basic80 | deep100
  "otherTypes": [],                    // other 必填（≥1）：screen|wifi|slow|other
  "contactName": "张三",
  "phone": "13800000000",
  "contactPref": "phone",              // phone | wechat
  "brandModel": "联想 拯救者 Y7000P",
  "modelPhotos": ["/uploads/2026/10/xxx.jpg"],
  "description": "风扇声音大",
  "serviceMode": "shop",               // shop | home
  "preferredTime": "尽快",              // 尽快|今天|明天|yyyy-MM-dd HH:mm
  "address": null                      // 选填；仅 shop 时可为空
}
```

响应：

```jsonc
{
  "code": 0,
  "message": "ok",
  "data": {
    "orderId": "R20261005-001",
    "etaText": "我们会在 30 分钟内按您选的方式（电话 / 微信）联系您",
    "isBusinessHours": true,
    "createdAt": "2026-10-05T06:30:00.000Z"
  }
}
```

服务端处理链（对应 PRD 规则）：Zod 校验 → 手机号校验（40002）→ 10 分钟去重（40003）→ 当日 5 单限流（40004）→ 生成单号 → 落库 → 推送通知并写 `notification_logs` → 返回单号与时效文案。

#### POST `/api/aftersales` — 提交售后报修 [REQ-10]

请求体：`{ "phone": "13800000000", "description": "清灰后风扇声音变大", "media": [] }`

响应：`{ "code": 0, "data": { "aftersaleId": "A20261005-001", "matchedOrderId": "R20260928-003", "inWarranty": true, "etaText": "已收到，我们会尽快联系您核对" } }`

> 售后提交**不修改** `orders.status`；订单进入「售后」由店主在后台 `PATCH /api/admin/orders/{id}` 手动设置。

#### GET `/api/orders/{id}` — 成功页脱敏摘要

响应仅含 `orderId / serviceType / cleanTier / etaText / createdAt`（**不含 `status`、手机号、联系人、地址、描述、照片**），供成功页刷新使用。

#### GET `/api/aftersales/lookup?phone=13800000000` — 售后页自动匹配订单 [C2]

响应：

```jsonc
{
  "code": 0,
  "data": {
    "found": true,
    "orderId": "R20260928-003",
    "serviceType": "clean",
    "cleanTier": "basic80",
    "status": "done",
    "orderDate": "2026-09-28",
    "inWarranty": true,
    "warrantyEndDate": "2026-10-05"
  }
}
```

> 匹配规则：取该手机号**最近一笔**订单；保修口径为「交付日计第 1 天，共 7 个自然日，截止日 = 交付日 + 6 天」，交付日暂以订单创建日近似（PRD §7.4）。查不到返回 `found: false`，**不阻止提交**。

#### POST `/api/upload` — 图片上传 [A5 / B3 / C4]

- `multipart/form-data`，字段名 `file`；单张 ≤5MB；**总张数上限 3 张由前端限制，服务端只校验类型与单张大小**。
- 服务端：`sharp` 旋转校正 → 长边压缩至 1920 → 质量 80 → 统一输出 JPG（HEIC 转码）→ 存 `storage/uploads/yyyy/MM/xxxx.jpg` → 返回相对 URL。
- 响应：`{ "code": 0, "data": { "url": "/uploads/2026/10/xxxx.jpg", "size": 186342, "width": 1920, "height": 1080 } }`（以 API 契约 §3.5 为准）

### 4.3 后台接口（均需登录，Cookie 会话）

| 方法 | 路径 | 说明 | 对应 PRD |
| --- | --- | --- | --- |
| POST | `/api/admin/login` | 登录，成功后下发 HttpOnly Cookie（有效期 8h） | REQ-13 |
| POST | `/api/admin/logout` | 退出登录 | REQ-13 |
| GET | `/api/admin/session` | 当前登录态（前端路由守卫用） | REQ-13 |
| GET | `/api/admin/orders` | 列表：`?status=&phone=&page=&size=` 按 `created_at` 倒序 | 订单列表 |
| GET | `/api/admin/orders/{id}` | 详情：全部字段 + 照片 + 关联售后 | 订单详情 |
| PATCH | `/api/admin/orders/{id}` | 修改 `status` / `remark` / `final_price` | 改状态、备注 |
| GET | `/api/admin/aftersales` | 售后列表（含关联订单信息） | 售后列表 |
| GET | `/api/admin/aftersales/{id}` | 售后详情 | 售后详情 |
| PATCH | `/api/admin/aftersales/{id}` | 修改售后 `status` / `remark` | 售后处理 |
| GET | `/api/admin/export?type=orders\|aftersales` | 导出 CSV（UTF-8 BOM，Excel 可直接打开） | 一键导出 |
| GET | `/api/admin/stats`（可选） | 今日订单数、本周完成数 | 可选统计 |

---

## 5. 关键实现说明

### 5.1 校验规则（Zod schema ↔ PRD 字段表）

| 字段 | 规则 | PRD 出处 |
| --- | --- | --- |
| `contactName` | 1–20 字，非空 | A2 |
| `phone` | `^1[3-9]\d{9}$`，**拒绝座机** | A3 / C1 |
| `brandModel` | 1–50 字 | A4 |
| `modelPhotos` | ≤3 项，URL 前缀白名单 `/uploads/` | A5 |
| `description` | ≤300 字，选填（「其他问题」选「其他」时必填） | A6 / B2 |
| `otherTypes` | 「其他问题」时 ≥1 项 | B1 |
| `contactPref` | 枚举 `phone`/`wechat` | A7 |
| `serviceMode` | 枚举 `shop`/`home` | A8 |
| `preferredTime` | 枚举「尽快/今天/明天」或 `yyyy-MM-dd HH:mm` | A9 |
| `address` | ≤100 字，仅 `serviceMode=home` 时允许非空 | A10 |

> 同一份 schema 在**前端（提交前即时校验）**与**接口（服务端强校验）**复用，错误 message 直接作为页面提示文案（PRD 要求的提示语原样写进 schema）。

### 5.2 防重与限流 [REQ-09]

| 规则 | 实现 |
| --- | --- |
| 10 分钟同内容去重 | 计算 `dedupeKey = sha1(phone + serviceType + cleanTier + otherTypes排序后join + description + serviceMode + address)`（空值归一：`null` 与 `""` 等同、`null` 与 `[]` 等同），查询 `phone + created_at > now-10min` 的记录做比对，命中则返回 40003 |
| 当日 5 单限流 | `COUNT(*) WHERE phone=? AND created_at >= 当日 00:00`，≥5 返回 40004 |
| 上传限流 | 同 IP 限流，阈值由配置项 `UPLOAD_RATE_LIMIT_PER_HOUR` 控制（默认 30），属技术防护，**非 PRD 验收项** |
| 前端防连点 | 提交后按钮立即置灰显示「提交中…」（UIUX §6.1 加载态） |
| 无 Redis 的理由 | 量级极小，走 `idx_orders_phone_created` 索引查询；如后期量增大可平滑切换到 Redis |

### 5.3 通知推送 [REQ-12]

```
提交成功 → 组装模板（PRD §6.1，含联系偏好、上门高亮、期望时间）
        → 按 NOTIFY_PROVIDER 选择通道：
             wecom      : POST WECOM_WEBHOOK_URL  (markdown 消息)
             serverchan : POST https://sctapi.ftqq.com/{KEY}.send
             console    : 打印到终端（本地开发默认）
        → 写 notification_logs（成功/失败 + 原文 + 错误）
        → 更新 orders.notify_status
```

- **失败兜底**：通知失败不阻塞下单（客户体验优先），但订单列表将 `notify_status=failed` 的行标红，店主仍可在后台看到（对应风险 R3）。
- 模板字段与 PRD §6.1 完全一致，示例：

```
【xiu xiu · 新订单 R20261005-001】
类型：清灰换硅脂 · 标准 ¥80（含 7 天保修）
联系人：张三  13800000000
联系偏好：📞 电话
机型：联想 拯救者 Y7000P（照片 2 张）
故障：风扇声音大，玩游戏发烫
服务方式：🚪 上门（期望：明天下午）—— 需排期；费用单独沟通确认
地址：XX 小区 X 栋 X 单元
```

**售后通知模板（PRD §6.1）**：

```
【xiu xiu · 售后报修 A20261005-001】
手机号：13800000000
关联订单：R20260928-003 清灰换硅脂 ¥80（2026-09-28，7 天内 ✓）
问题：清灰后风扇声音变大
```

### 5.4 图片上传与处理 [REQ-08]

1. 前端：`<input type="file" accept="image/*">` → 浏览器 canvas 压缩（长边 ≤1920、质量 0.8）→ POST `/api/upload`。
2. 服务端：`sharp` 再次压缩（防御性处理）→ `rotate()` 校正 EXIF 方向 → `jpeg({ quality: 80 })` → 落盘。
3. HEIC（iPhone 默认）由 sharp/libvips 转 JPG；若运行环境不支持 HEIC 解码，接口返回 40005 并在前端提示「请改用 JPG/PNG，或在微信中直接发送照片给店主」。
4. 限制：单张 ≤5MB、仅图片类型；总张数 3 张由前端限制（服务端不聚合校验）；文件名随机化，避免路径穿越。

### 5.5 售后匹配与保修判断 [REQ-10 / §7.4]

```
输入手机号 → 查最近一笔订单（idx_orders_phone_created）
          → 保修口径：交付日=订单创建日（近似），交付日计第 1 天，共 7 个自然日
            保修截止日 = 交付日 + 6 天；今日 ≤ 截止日 → 保修期内
          → 返回给前端展示「保修期内 ✓」（仅提示，不阻断）
提交售后 → 落库 aftersales（order_id 与 in_warranty 一并写入）
        → 通知店主（含关联订单信息）
```

### 5.6 后台鉴权 [REQ-13]

- 密码以 `bcrypt` 哈希存库（`scripts/hash-password.ts` 生成，成本因子 10）。
- 登录成功签发 JWT（`jose`，HS256，密钥 `SESSION_SECRET`，有效期 8h），写入 `HttpOnly` + `SameSite=Lax` + `Secure`（生产）Cookie。
- `src/middleware.ts` 拦截 `/admin/*`：无有效 Cookie 一律 302 到 `/admin/login`；接口层再校验一次（双保险）。
- 生产必须 HTTPS（PRD §9 非功能要求）。

### 5.7 营业时间与联系时效文案 [REQ-09]

- 统一按 `Asia/Shanghai` 判断提交时间是否落在 9:00–17:00。
- 营业时间内 → 「我们会在 30 分钟内按您选的方式（电话 / 微信）联系您」；
- 非营业时间 → 「我们会在次日 9:00 后尽快联系您」。
- 文案集中在 `src/lib/constants.ts`，避免散落在页面里。

### 5.8 CSV 导出 [REQ-13]

- 字段：单号、时间、类型、套餐、联系人、电话、联系偏好、机型、服务方式、期望时间、地址、状态、最终价格、备注。
- 以 UTF-8 + BOM 输出，保证 Excel 双击不乱码；文件名 `orders_20261005.csv`。
- 备注含换行时用双引号包裹转义。

### 5.9 前端实现要点（对齐 UIUX v1.1）

| 要点 | 做法 |
| --- | --- |
| 设计令牌 | UIUX §3.4 的 CSS 变量写入 `globals.css`，Tailwind 通过 `@theme` 引用，禁止散落硬编码色值 |
| iOS 分组列表 | 表单用「分组卡片 + 行内标签/输入 + 分隔线左缩进」，不用传统带框表单 |
| Large Title 收缩 | 滚动监听切换导航栏状态（透明 → 毛玻璃 + 小标题） |
| 底部固定操作栏 | `position: fixed` + 毛玻璃 + `env(safe-area-inset-bottom)`；内容区预留底部内边距 |
| Bottom Sheet | 期望时间选择用半屏抽屉（含抓手条、遮罩、焦点锁定） |
| 二维码模块 | **`<img>` 加载 + 白底留白 ≥8px + 无覆盖无滤镜**，否则微信无法长按识别（UIUX §6.7 硬约束） |
| 背景降级 | `HERO_MODE = 'video' \| 'motion'`；无视频/弱网/省流/自动播放被拒 → 纯 CSS 动态背景兜底，永不白屏 |
| 无障碍 | 尊重 `prefers-reduced-motion`、热区 ≥44px、输入框 ≥16px、错误态不引起布局跳动 |
| 占位图 | `public/wechat-qr.png`、`public/sample-model-label.jpg` 先用等尺寸占位图，上线前替换 |

### 5.10 视频与素材策略 [REQ-02/03/04]

- 有 `public/hero-bg.mp4` → 播放（h.264 / ≤5MB / 无音轨 / `muted playsinline loop`）；
- `canplay` 后 800ms 淡入覆盖；3 秒未就绪或 `play()` 被拒 → 移除视频元素，保持动态背景（不得出现闪白）。

---

## 6. 本地预览指南

### 6.1 环境要求

| 项 | 要求 | 本机现状 |
| --- | --- | --- |
| Node.js | ≥ 20（建议 22/24） | ✅ v24.11.1（`D:\Nodejs`） |
| 包管理器 | pnpm ≥ 9 | ✅ 已安装 |
| 数据库 | PostgreSQL 16（推荐 Docker 一键启动） | 需安装 Docker Desktop（或本机安装 PG 16） |
| Docker | ≥ 24（仅用于启动本地数据库） | ✅/需安装 |
| npm 源 | 国内镜像（`.npmrc` 已配 `registry.npmmirror.com`） | ✅ |

### 6.2 一次性初始化

```bash
pnpm install                 # 安装依赖
pnpm db:up                   # 启动本地 PostgreSQL 16（docker compose）
cp .env.example .env         # 复制环境变量（Windows: copy .env.example .env）
pnpm hash-password 你的密码   # 生成 ADMIN_PASSWORD_HASH，粘贴进 .env
pnpm db:push                 # 建表（prisma db push）
pnpm db:seed                 # 写入管理员 + 演示订单/售后
pnpm dev                     # 启动开发服务
```

`.env` 关键项（其余见 `.env.example`）：

```bash
DATABASE_URL="postgresql://xiuxiu:xiuxiu@localhost:5432/xiuxiu?schema=public"
ADMIN_USERNAME=admin
ADMIN_PASSWORD_HASH=<pnpm hash-password 生成>
SESSION_SECRET=dev-only-please-change-me
NOTIFY_PROVIDER=console
```

> 不想用 Docker：安装本机 PostgreSQL 16，建库 `xiuxiu`，把 `DATABASE_URL` 改成本机连接串即可，其余步骤不变。

### 6.3 访问地址

| 页面 | 地址 |
| --- | --- |
| 首屏欢迎页 | http://localhost:3000/ |
| 下单主页 | http://localhost:3000/order |
| 提交成功页 | http://localhost:3000/success?orderId=R20261005-001 |
| 售后报修 | http://localhost:3000/aftersale |
| 极简后台 | http://localhost:3000/admin（默认账号 `admin`，密码为 §6.2 所设） |

> 移动端预览：Chrome DevTools 切 iPhone 设备模式；或用局域网 IP（`pnpm dev --hostname 0.0.0.0`）用真机访问 `http://<本机IP>:3000`。微信内浏览器验证需内网穿透（如 cpolar/ngrok），**验收阶段必做**（PRD §10 要求微信环境走查）。

### 6.4 种子数据

| 数据 | 内容 |
| --- | --- |
| 管理员 | `admin` / 由 `hash-password` 设定 |
| 演示订单 1 | `R20261005-001` 清灰换硅脂·深度清洁 ¥100，上门，微信联系，待处理（含 2 张占位照片） |
| 演示订单 2 | `R20261004-001` 其他问题·屏幕故障，到店，电话联系，已完成 |
| 演示售后 | `A20261005-001` 关联演示订单 1，`in_warranty=true` |

### 6.5 常见问题

| 现象 | 处理 |
| --- | --- |
| `Can't reach database server` | 本地 PostgreSQL 未启动：执行 `pnpm db:up`，等 5 秒后重试 |
| 端口 5432 被占用 | 改 `deploy/docker/docker-compose.yml` 映射为 `5433:5432`，同步修改 `.env` 的 `DATABASE_URL` |
| 时间显示差 8 小时 | 库里存 UTC 属正常；确认展示层统一按 `Asia/Shanghai` 格式化 |
| `sharp` 安装失败 | 执行 `pnpm rebuild sharp`；国内网络慢时确认 `.npmrc` 指向 npmmirror |
| 没收到通知 | 本地默认 `NOTIFY_PROVIDER=console`，通知打印在 `pnpm dev` 的终端里 |
| 二维码占位图 | 上线前替换 `public/wechat-qr.png`（≥400×400，白底、留白 ≥8px） |
| 端口占用 | `pnpm dev -p 3001` |

### 6.6 冒烟检查清单（对照 PRD §10 验收）

```bash
# 1. 首页可访问
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/
# 2. 下单接口（正常）
curl -s -X POST http://localhost:3000/api/orders -H "Content-Type: application/json" \
  -d '{"serviceType":"clean","cleanTier":"basic80","contactName":"张三","phone":"13800000000","contactPref":"phone","brandModel":"联想 Y7000P","serviceMode":"shop","preferredTime":"尽快"}'
# 3. 重复提交 → 期望 code=40003
# 4. 座机号 → 期望 code=40002（注意补齐 cleanTier/otherTypes，否则会先被 40001 拦截）
curl -s -X POST http://localhost:3000/api/orders -H "Content-Type: application/json" \
  -d '{"serviceType":"clean","cleanTier":"basic80","otherTypes":null,"contactName":"李四","phone":"07541234567","contactPref":"phone","brandModel":"X","modelPhotos":[],"description":null,"serviceMode":"shop","preferredTime":"尽快","address":null}'
# 5. 后台未登录 → 期望 401
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3000/api/admin/orders
# 6. 售后匹配
curl -s "http://localhost:3000/api/aftersales/lookup?phone=13800000000"
```

| # | 检查项 |
| --- | --- |
| 1 | 首屏、下单、售后页在 375px 下布局正常，无横向滚动 |
| 2 | 服务类型切换 → 表单详情区联动；选「上门」出现规则提示与地址栏 |
| 3 | 「其他问题」选「其他」时补充描述变必填 |
| 4 | 联系偏好选「微信」时二维码高亮，且微信内可长按识别 |
| 5 | 提交成功页显示单号与时效文案（非营业时间文案自动切换） |
| 6 | 后台可登录、列表倒序、改状态与备注生效、CSV 可打开 |
| 7 | 通知内容包含联系偏好、上门标记与期望时间 |
| 8 | 通知失败时订单列表标红（`notify_status=failed`） |

---

## 7. 部署与上线

### 7.1 环境变量清单（生产）

| 变量 | 说明 |
| --- | --- |
| `DATABASE_URL` | PostgreSQL 连接串（含库名、账号、密码、`schema=public`；生产建议 `?sslmode=require`） |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD_HASH` | 后台账号与哈希 |
| `SESSION_SECRET` | 随机 32 位以上字符串 |
| `NOTIFY_PROVIDER` | `wecom` 或 `serverchan` |
| `WECOM_WEBHOOK_URL` / `SERVERCHAN_KEY` | 通知凭据（**只放服务器，不入库**） |
| `APP_BASE_URL` | 正式域名（用于生成绝对链接） |

### 7.2 上线步骤

1. **ICP 备案**（PRD §9 / REQ-16）：开工后尽早启动，周期 1–2 周，店主提供证件资料；
2. 域名解析到国内服务器 → 申请证书（Let's Encrypt 或云厂商免费证书）；
3. `pnpm build && pnpm start`（PM2 守护）或 Docker 部署（`deploy/docker`）；
4. Nginx：443 HTTPS、80 跳 443、`/uploads` 静态直出、`client_max_body_size 10m`；
5. 生产建表：配置生产 `DATABASE_URL` 后**只执行** `pnpm db:migrate deploy`（生产**禁止** `db push`）；初始化管理员用 `SEED_MODE=admin pnpm db:seed`（**演示数据不得进入生产**）；
6. 替换素材：`wechat-qr.png`、`sample-model-label.jpg`（如需视频再放 `hero-bg.mp4`）；
7. 配置企微机器人并验证真机收到通知；
8. 真机走查：iOS + Android 微信内各跑一遍全流程（PRD §10）。

### 7.3 备份与数据安全

| 项 | 方案 |
| --- | --- |
| 数据库备份 | PostgreSQL 每日 `pg_dump -Fc` 到对象存储，保留 14 天；云数据库优先开启自动备份与 PITR |
| 上传文件 | `storage/uploads` 与数据库同周期备份（或直接使用对象存储） |
| 隐私 | 手机号仅在后台与通知中出现，公开页面不展示（PRD §9）；页面底部保留隐私说明 |
| 密钥 | `.env` 不入库；服务器权限最小化 |
| 日志 | 应用日志 + `notification_logs` 表，保留 90 天 |

---

## 8. 质量保障

### 8.1 测试策略（小体量，抓重点）

| 层级 | 范围 | 方式 |
| --- | --- | --- |
| 单元测试 | `src/lib/validation.ts`、单号生成、保修判断、去重与限流 | Vitest（可选引入） |
| 接口冒烟 | §6.6 的 curl 清单 | 手工脚本 |
| 页面走查 | UIUX §12.2 设计验收清单 + PRD §10 验收清单 | 真机 + DevTools 设备模式 |
| 微信专项 | 视频降级、二维码长按识别、键盘弹起 | iOS + Android 各一台 |
| 回归 | 每次改动跑一遍冒烟清单 | 手工 |

### 8.2 与 PRD 验收标准的对应

PRD §10 的 18 条验收项逐条落到：页面（§2.2）、接口（§4）、业务规则（§5）。新增的 3 条（通知失败标红、后台未登录 401、CSV 可打开）已并入 §6.6 冒烟清单。

---

## 9. 里程碑与排期（建议）

| 阶段 | 内容 | 产出 | 预估 | 依赖 |
| --- | --- | --- | --- | --- |
| M0 | 文档评审（本文档 + PRD + UIUX） | 评审结论、待确认项关闭 | 0.5 天 | 店主确认文案与素材时间 |
| M1 | 工程骨架 + 数据库 + 种子 | 可 `pnpm dev` 打开空壳页面 | 0.5 天 | M0 |
| M2 | 服务端核心库 + 全部接口 | curl 冒烟通过 | 1.5 天 | M1 |
| M3 | C 端 5 个页面（含表单交互与校验） | 手机端可完整下单 | 2 天 | M2 |
| M4 | 后台 4 个页面（列表/详情/状态/导出） | 店主可管理订单 | 1.5 天 | M2 |
| M5 | 联调 + 微信真机走查 + 修复 | 验收清单全绿 | 1 天 | M3、M4 |
| M6 | 上线准备（备案、证书、素材替换、通知验证） | 正式域名可访问 | 与 M1–M5 并行 | 店主素材 + 备案 |
| M7 | 上线 + 观察 3 天 | 稳定运行、漏单率为 0 | 0.5 天 | M6 |

**并行事项（越早越好）**

| 事项 | 责任方 | 建议截止 |
| --- | --- | --- |
| ICP 备案资料 | 店主 | M1 结束前 |
| 官方微信二维码 | 店主 | M5 前 |
| 型号示例图 | 店主 | M5 前 |
| 首屏文案三选一、slogan 定稿 | 店主 | M3 前 |
| 7 天保修细则确认 | 店主 | M4 前 |

---

## 10. PRD 追溯矩阵

| PRD 需求 | 页面/入口 | 接口 | 数据字段 / 规则 |
| --- | --- | --- | --- |
| REQ-01 首屏 | `(site)/page.tsx`（已改版：工作台风格落地页，见交付清单 §2.1 增补） | — | — |
| REQ-02/03 Hero 与降级 | `components/site/Hero.tsx`（**未挂载**，保留为可选方案） | — | `HERO_MODE`，§5.10 |
| REQ-04 动态背景兜底 | 首页装饰动效（`home-motion.css` + `HomeAtmosphere`，尊重 `prefers-reduced-motion`） | — | 纯 CSS，UIUX §8.2 |
| REQ-05 表单 | `(site)/order/page.tsx` | POST `/api/orders` | `orders` 全表 |
| REQ-06 清灰换硅脂（含上门规则） | 服务选择 + 上门提示 | POST `/api/orders` | `clean_tier`、`service_mode`、`address`、`preferred_time`；规则 §7.1 |
| REQ-07 其他问题 | 多选标签 + 补充描述 | POST `/api/orders` | `other_types`、`description` |
| REQ-08 型号照片与示例图 | 上传组件 + 示例图 | POST `/api/upload` | `model_photos`；§5.4 |
| REQ-09 提交与异常 | 底部操作栏 + 成功页 | POST `/api/orders` | 错误码 40003/40004；时效文案 §5.7 |
| REQ-10 售后报修 | `(site)/aftersale/*` | POST `/api/aftersales`、GET `/api/aftersales/lookup` | `aftersales` 全表；§5.5 |
| REQ-11 底部信息区 | 站点 layout | — | 店名/电话/时间/二维码/隐私说明 |
| REQ-12 通知 | — | 服务端 `notify.ts` | `notification_logs`、`notify_status`；§5.3 |
| REQ-13 极简后台 | `admin/*` | `/api/admin/*` | `status`、`remark`、`final_price`；§5.6 |
| REQ-14 状态机 | 后台状态变更 | PATCH `/api/admin/orders/{id}` | `status` 五态 §3.7 |
| REQ-15 视觉规范 | 全部页面 | — | UIUX §3 令牌（`globals.css`） |
| REQ-16 备案与 HTTPS | — | — | §7.2 |
| REQ-17 微信与联系偏好 | 二维码模块（4 处） | POST `/api/orders` | `contact_pref`；UIUX §6.7 |

---

## 11. 风险与待确认项

### 11.1 风险

| # | 风险 | 影响 | 应对 |
| --- | --- | --- | --- |
| R1 | 微信内核视频自动播放被拒 / X5 内核表现差异 | Hero 观感 | 动态背景兜底永不白屏；真机双端走查（§6.6） |
| R2 | 二维码被遮挡或非 `<img>` 实现 | 客户加不上微信 | UIUX §6.7 硬约束 + 真机长按识别验证 |
| R3 | 通知静默失败等同漏单 | 直接业务损失 | `notification_logs` 落库 + 列表标红 + 每日人工核对（§5.3） |
| R4 | 备案周期 1–2 周拖慢上线 | 上线延期 | M1 前提交资料，域名解析与服务器并行准备 |
| R5 | 素材（二维码/示例图）延期 | 上线受阻 | 等尺寸占位图先行，替换零布局变化 |
| R6 | HEIC 转码在服务器不可用 | 部分 iPhone 照片上传失败 | sharp 转码失败时返回明确提示，引导用户改用 JPG/PNG |
| R7 | 本地需 Docker 启动 PostgreSQL，新环境上手略重 | 预览门槛 | 提供 `pnpm db:up` 一键命令 + `.env` 模板；无 Docker 时可改用本机安装的 PG 16 或云端测试库 |
| R8 | 失去 Redis 后限流被绕过（多 IP 刷单） | 垃圾订单 | 当日 5 单按手机号限制 + 后台可删单；量级可接受 |

### 11.2 待确认项（需回复后开工）

| # | 待确认 | 默认建议 |
| --- | --- | --- |
| 1 | 是否同意废弃 `backend/`（Java）骨架，改为 Next.js 全栈 | **建议同意**（§1.2） |
| 2 | 生产数据库用云 PostgreSQL 还是自建 | 建议云数据库（自动备份 + PITR，免运维） |
| 3 | 后台登录是否只需单账号 | 建议单账号 + 强密码（店主一人使用） |
| 4 | 通知通道选企微机器人还是 Server 酱 | 建议企业微信机器人（免费、群内可见、可多人接收） |
| 5 | 上传文件存本地磁盘还是对象存储 | 建议先本地磁盘，图片量上升后再切 OSS（接口不变） |
| 6 | 首屏文案与 slogan 定稿 | 见 PRD 附录 C 三选一 |
| 7 | 是否引入 Vitest 做单元测试 | 建议引入（校验/单号/保修三处最值得测） |

---

*文档结束。本文档评审通过后再开始编码；编码期间若与 PRD 冲突，以 PRD 为准并回改本文档。*
