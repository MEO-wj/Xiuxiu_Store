# XiuXiu_Store · xiu xiu 客户下单系统

电脑维修单店接单系统：客户手机网页自助下单（清灰换硅脂 / 其他问题 / 售后报修），店主微信收通知、后台管订单。

> **需求唯一口径**：`docs/prd/Xiuxiu_PRD_v1.3.md`
> **视觉口径**：`docs/prd/Xiuxiu_UIUX_Design_v1.1.md`（闪修侠结构 + Apple/iOS 风格）
> **技术方案**：`docs/plan/Xiuxiu_开发文档_v1.1.md`
> **实现契约**：`docs/api/`（API 契约 + 数据库契约 + openapi.yaml）

## 技术栈

| 层 | 选型 | 说明 |
| --- | --- | --- |
| 全栈框架 | Next.js 15.5（App Router）+ React 19 | 一个应用承载 C 端、后台与 REST API |
| 语言 | TypeScript 5.9（strict） | 前后端共用类型；Zod schema 前后端复用 |
| 样式 | Tailwind CSS 4 + CSS 变量令牌 | 令牌定义见 UIUX §3.4 |
| 数据库 | PostgreSQL 16（Prisma 6） | 本地 Docker，生产云数据库，同引擎同大版本 |
| 校验 | Zod 4 | 前端即时校验与接口强校验同一份 schema |
| 鉴权 | jose（JWT）+ bcryptjs | 后台 HttpOnly Cookie 会话，8 小时 |
| 图片 | sharp | 压缩至长边 1920、质量 80、HEIC → JPG |
| 通知 | 企业微信机器人 / Server 酱 / console | 本地默认 console，失败落 `notification_logs` |

## 目录结构

```text
XiuXiu_Store/
├── src/
│   ├── app/
│   │   ├── (site)/            # C 端：/（工作台风格首页）· /order（两步下单）· /success · /aftersale(/success)
│   │   ├── admin/             # 极简后台：login · orders(+[id]) · aftersales
│   │   ├── api/               # REST：orders · aftersales · upload · admin/*
│   │   ├── globals.css        # 设计令牌与断点（UIUX §3.4，tablet/desktop 令牌见实施约定 §1）
│   │   ├── site.css           # 首页工作台场景样式
│   │   ├── home-motion.css    # 首页装饰动效（尊重 prefers-reduced-motion）
│   │   ├── mobile-home.css    # 移动端首页样式
│   │   └── layout.tsx
│   ├── components/
│   │   ├── ui/                # Button / Field / Segmented / Chip / Notice / QrCard / BottomBar / Skeleton / Toast / Spinner
│   │   ├── site/              # 首页工作台（SiteHeader/HomeExperience/HomeAtmosphere/RepairScene/WorkbenchProps/MobileHome/ServiceIcon）
│   │   │                      # 与业务组件（NavBar/Hero*/BottomSheet/PreferredTimeSheet/PhotoUploader/SiteFooter/icons/keyframes）
│   │   └── admin/             # 后台业务组件（StatusBadge、AdminNav）
│   ├── lib/                   # constants（枚举/文案/阈值）· types · validation（Zod）· format（单号/保修/时区）· response
│   ├── server/                # db · order-service · aftersale-service · notify · auth · upload · export · money
│   └── middleware.ts          # /admin/* 会话保护
├── prisma/                    # schema.prisma（PostgreSQL）· seed.ts（SEED_MODE=demo|admin）· README.md
├── scripts/                   # hash-password · make-placeholders · verify-core（132 项自测）· verify-fixes（22 项回归）
│                              # · smoke-api.mjs（44 项契约冒烟）· run-smoke.ps1（一键冒烟）
├── deploy/docker/             # docker-compose.yml（本地 PostgreSQL 16）
├── public/                    # wechat-qr.png / sample-model-label.jpg（占位图，上线前替换）
├── storage/uploads/           # 用户上传（本地开发）
└── docs/{prd,plan,api}/       # 需求、技术方案、契约
```

## 本地预览

```bash
pnpm install
pnpm db:up                  # 启动本地 PostgreSQL 16（Docker）
cp .env.example .env        # Windows: copy .env.example .env
pnpm hash-password 你的密码  # 生成 ADMIN_PASSWORD_HASH 并粘贴进 .env
pnpm db:push                # 建表
pnpm db:seed                # 种子数据（SEED_MODE=demo）
pnpm dev                    # http://localhost:3000
```

| 页面 | 地址 |
| --- | --- |
| 工作台首页 / 两步下单 / 成功 | `/` · `/order` · `/success` |
| 售后报修 / 售后成功 | `/aftersale` · `/aftersale/success` |
| 极简后台 | `/admin`（默认账号 `admin`） |

其他命令：`pnpm typecheck`（类型检查）、`pnpm build`（生产构建）、`pnpm db:studio`（数据可视化）、`pnpm exec tsx scripts/verify-core.ts`（核心规则自测 132 项）、`pnpm exec tsx scripts/verify-fixes.ts`（修复回归 22 项）。

### 一键冒烟（构建 + 启服务 + 契约断言）

```bash
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/run-smoke.ps1
```

该脚本会自动清理 3000 端口残留进程 → `pnpm start` → 等待就绪 → 执行 `scripts/smoke-api.mjs`（44 项契约断言，含脱敏、40002/40003/40006/40100、CSV BOM、上传可访问）→ 杀进程树并清理测试数据。

> 无 Docker 时可安装本机 PostgreSQL 16，或指向云端测试库，仅需改 `.env` 的 `DATABASE_URL`。

## V1 范围

**做**：工作台风格首页（装饰动效可暂停、指针视差、移动端专属版式）、两步下单（先选服务再填信息，清灰换硅脂 ¥80/¥100 · 其他问题）、上门服务（需排期、10 公里内不加价）、联系偏好自选（电话/微信）+ 官方微信二维码、售后报修（7 天保修）、微信通知店主、极简后台（登录/列表/详情/改状态/备注/导出 CSV）、桌面端适配（tablet ≥768px / desktop ≥1200px，约定见 `docs/plan/桌面端适配与两步下单_v1.0.md`）。

**不做**（二期候选）：在线支付、注册登录、维修进度自助查询、微信小程序、站内实时聊天、优惠券、维修知识页。

## 质量与验收

| 项 | 位置 / 方式 |
| --- | --- |
| 核心规则自测 | `scripts/verify-core.ts`：单号、去重哈希归一、保修边界、营业时间文案、状态流转矩阵、Zod 校验、CSV 转义（132 项） |
| 接口冒烟 | API 契约 §8.1 的 curl 清单 |
| 验收清单 | PRD §10（功能）、UIUX §12.2（设计）、API 契约 §8.2（契约）、数据库契约 §14（改表自查） |
| 真机走查 | 微信内置浏览器 iOS + Android 各一台（视频降级、二维码长按识别、键盘弹起） |

## 文档索引

| 文档 | 说明 |
| --- | --- |
| `docs/prd/Xiuxiu_PRD_v1.3.md` | 产品需求：范围、字段校验、业务规则、状态机、数据模型、验收标准 |
| `docs/prd/Xiuxiu_UIUX_Design_v1.1.md` | 前端设计：iOS 风格、设计令牌、15 张移动端布局图、动效、微信适配 |
| `docs/plan/交付清单_v1.0.md` | **交付物清单**：逐文件交付明细、功能对照、验证证据、本地预览、待办与交付边界 |
| `docs/plan/验收报告_v1.0.md` | 逐条验收证据（PRD §10 / UIUX §12.2 / API §8 / DB §14）+ review 结论与修复记录 |
| `docs/plan/Xiuxiu_开发文档_v1.1.md` | 技术方案：选型、架构与目录、数据库设计、接口摘要、关键实现、本地预览、部署与排期 |
| `docs/plan/桌面端适配与两步下单_v1.0.md` | 实施约定：断点令牌、两步下单流程契约、桌面两栏与回归红线 |
| `docs/api/Xiuxiu_API契约_v1.0.md` | 接口契约：通用约定、错误码、C 端 5 接口、后台 11 接口、状态约束、时序、冒烟 |
| `docs/api/Xiuxiu_数据库契约_v1.0.md` | 数据库契约：数据字典、值域、不变量、索引、单号、事务、迁移与生命周期 |
| `docs/api/openapi.yaml` | OpenAPI 3.1 规格（可导入 Postman / Swagger UI） |

## 上线前必办

1. ICP 备案（周期 1–2 周，需尽早启动）
2. 替换占位素材：`public/wechat-qr.png` → 店主提供的 PNG 二维码；`sample-model-label.jpg` → 实拍型号标签图
3. 生产数据库仅用 `pnpm db:migrate:deploy`（禁止 `db push`），种子用 `SEED_MODE=admin`
4. 配置 `NOTIFY_PROVIDER=wecom`（或 serverchan）并真机验证通知
5. HTTPS + Nginx（`/uploads` 静态直出）
