# 「xiu xiu」客户下单系统 · API 契约

## 0. 文档信息

| 项目 | 内容 |
| --- | --- |
| 文档名称 | API 契约（REST API Contract） |
| 版本 | v1.0 |
| 日期 | 2026-10-05 |
| 状态 | 待评审确认 |
| 协议 | HTTPS + JSON（`Content-Type: application/json; charset=utf-8`） |
| 上级文档 | `docs/plan/Xiuxiu_开发文档_v1.1.md` §4（接口契约摘要） |
| 关联文档 | `docs/api/Xiuxiu_数据库契约_v1.0.md`（字段与取值域权威）、`docs/api/openapi.yaml`（机器可读规格） |
| 需求来源 | `docs/prd/Xiuxiu_PRD_v1.3.md`（REQ-05~REQ-17） |
| 契约效力 | 本文档是接口**行为、字段、错误码的唯一权威**；`openapi.yaml` 为同内容的机器可读版本，二者冲突时以本文档为准并回改 YAML |

> **契约变更规则**：① 更新本文档 → ② 更新 `openapi.yaml` → ③ 更新前端 `src/lib/types.ts` 与 Zod schema → ④ 更新数据库契约（若涉及字段）→ ⑤ 记录变更日志。破坏性变更（删字段/改语义）需先加新字段并双写一个版本。

### 0.1 变更日志

| 版本 | 变更 |
| --- | --- |
| v1.0 | 初版：通用约定、公共对象、C 端 5 个接口、后台 11 个接口（含 session 与 stats）、状态流转接口约束、时序图、错误码与提示规范 |
| v1.0 · 修订 | 开工前基线校正（T13，同日）：修正去重口径、可空性、条件字段、40006 触发面、上传职责与错误响应结构 |

---

## 1. 通用约定

### 1.1 环境与 Base URL

| 环境 | Base URL |
| --- | --- |
| 本地开发 | `http://localhost:3000` |
| 生产 | `https://<备案域名>` |

所有路径以 `/api` 开头。**生产强制 HTTPS**（PRD §9）。

### 1.2 请求与响应格式

| 项 | 约定 |
| --- | --- |
| 编码 | UTF-8 |
| 请求体 | JSON（`multipart/form-data` 仅用于上传接口） |
| 字段命名 | **JSON 一律 camelCase**（数据库 snake_case，由 Prisma/serializer 映射） |
| 时间格式 | 响应统一 ISO 8601 带时区（UTC），如 `2026-10-05T06:30:00.000Z`；前端一律按 `Asia/Shanghai` 展示 |
| 金额格式 | 字符串（避免浮点精度问题），如 `"100.00"`；前端不加零时保留两位 |
| 空值 | 统一用 `null`，不使用空字符串表达「无」（`address` 例外：前端未填时提交 `""`，服务端存 `null`） |
| 未知字段 | 请求中出现未定义字段**直接返回 40001**（Zod strict 模式），防止拼写错误静默通过 |
| 响应体大小 | 单条记录 < 32KB（列表接口分页约束见 §1.7） |

### 1.3 统一响应体

```jsonc
// 成功
{ "code": 0, "message": "ok", "data": { /* 见各接口 */ } }

// 失败（字段级错误：data 携带定位信息）
{ "code": 40002, "message": "请填写正确的 11 位手机号", "data": { "field": "phone", "fields": [{ "field": "phone", "message": "请填写正确的 11 位手机号" }] } }

// 失败（非字段级错误：40003/40004/40005/40006/40100/40400/50000，data 为 null）
{ "code": 40003, "message": "您刚刚已提交过相同的订单", "data": null }
```

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `code` | number | `0` 表示成功；非 0 见 §1.4 |
| `message` | string | **可直接展示给用户的中文文案**（前端不得改写语义） |
| `data` | object \| array \| null | 成功时为业务数据；失败时为字段定位对象 `{ "field": "phone", "fields": [{ "field": "phone", "message": "..." }] }`（字段级错误）或 `null`（非字段级错误） |

> 前端提示规范：`message` 直接用于表单错误提示或 Toast；**不得**自行拼接或翻译。

### 1.4 错误码总表

| code | HTTP | message（示例） | 触发场景 | 前端处理 |
| --- | --- | --- | --- | --- |
| `0` | 200 | `ok` | 成功 | — |
| `40001` | 400 | `请检查填写内容` | Zod 校验失败（含未知字段、条件字段违规） | 用 `data.field` / `data.fields` 定位到字段并展示 `message` |
| `40002` | 400 | `请填写正确的 11 位手机号` | 手机号格式错误（含座机） | 手机号字段下方红字 |
| `40003` | 409 | `您刚刚已提交过相同的订单` | 同手机号 + 同内容 10 分钟内重复提交 | Toast + 保留已填内容 |
| `40004` | 429 | `提交过于频繁，请直接电话 18029516310 或加官方微信` | 同手机号当日超过 5 单 | Toast（PRD §5.2.4 指定文案） |
| `40005` | 400 | `图片格式或大小不符合要求` | 上传类型/单张大小不合法，或触发同 IP 限流（数量由前端限制） | 上传组件内提示 |
| `40006` | 400 | `当前状态不允许此操作` | 非法状态流转，或命中数据库契约 §5 矩阵中标 ⚠️「需备注」的流转但 `remark` 为空 | Toast，刷新列表 |
| `40100` | 401 | `登录已过期，请重新登录` | 后台未登录 / 会话失效 | 跳转 `/admin/login` |
| `40400` | 404 | `未找到该记录` | 按单号查询不存在 | 提示并返回列表 |
| `50000` | 500 | `提交失败，请重试或直接拨打 18029516310` | 服务端异常 | Toast + 保留已填内容（PRD REQ-09） |

**服务端日志要求**：非 `0` 的响应必须记录结构化日志（含 `code`、`path`、`traceId`），`50000` 额外记录堆栈。

### 1.5 鉴权

| 接口分组 | 鉴权方式 |
| --- | --- |
| C 端（`/api/orders`、`/api/aftersales*`、`/api/upload`） | **无需鉴权**（客户免登录，PRD §3.2）。防刷依赖手机号限流（§1.6） |
| 后台（`/api/admin/*`，除 `login`） | Cookie 会话：`xiuxiu_session`（JWT，HttpOnly + SameSite=Lax + Secure(生产)），有效期 8 小时 |

| 项 | 约定 |
| --- | --- |
| Cookie 名称 | `xiuxiu_session` |
| 失效响应 | `40100` + HTTP 401 |
| CSRF | 同源 Cookie + `SameSite=Lax`，并要求写操作 Content-Type 为 `application/json`（拒绝表单跨站提交） |
| 登录失败限制 | 同一账号连续 5 次失败锁定 10 分钟（返回 40001，`message` 提示稍后重试）**【技术防护建议，待确认】** |
| 登出 | 服务端清除 Cookie（无需黑名单，JWT 短期有效） |

### 1.6 防重与限流（C 端写接口）

| 接口 | 规则 | 超限返回 |
| --- | --- | --- |
| `POST /api/orders` | 同手机号 + 同内容 10 分钟内重复。去重哈希统一为 `sha1(phone + serviceType + cleanTier + otherTypes排序后join + description + serviceMode + address)`；空值归一（`null` 与 `''` 等同，`null` 与 `[]` 等同） | `40003` |
| `POST /api/orders` | 同手机号当日（Asia/Shanghai 自然日）≤5 单 | `40004` |
| `POST /api/aftersales` | 同手机号 + **同问题描述（精确匹配，含前后空白归一后比较）** 10 分钟内重复 | `40003` |
| `POST /api/upload` | 同 IP 限流，阈值由配置项 `UPLOAD_RATE_LIMIT_PER_HOUR` 控制（默认 30），单请求 ≤5MB；属技术防护**非 PRD 验收项** | `40005` |

> 所有规则在**服务端强制**，前端仅做体验层拦截（按钮置灰、提示），不承担安全职责。

### 1.7 分页与排序

请求：`?page=1&size=20`（`page` 从 1 开始，`size` 默认 20、最大 100）

响应：

```jsonc
{
  "code": 0,
  "message": "ok",
  "data": { "page": 1, "size": 20, "total": 37, "items": [ /* ... */ ] }
}
```

| 约定 | 说明 |
| --- | --- |
| 默认排序 | `createdAt DESC`（最新在前） |
| 允许排序 | V1 不支持自定义排序（后台按时间倒序即可） |
| 越界页码 | 返回空 `items` 与真实 `total`，不报错 |

### 1.8 文件上传约定

| 项 | 约定 |
| --- | --- |
| Content-Type | `multipart/form-data`，字段名 `file` |
| 允许类型 | `image/jpeg`、`image/png`、`image/webp`、`image/heic` |
| 大小 | 单张 ≤5MB（前端压缩后通常 <1MB）；服务端只校验单张大小 |
| 数量 | 每个表单最多 3 张，**由前端限制**；服务端只校验类型与单张大小，**不校验表单总张数** |
| 服务端处理 | `sharp`：EXIF 旋转校正 → 长边 ≤1920 → 质量 80 → **统一输出 JPG** |
| 存储路径 | `storage/uploads/yyyy/MM/<random>.jpg`，返回相对 URL `/uploads/yyyy/MM/<random>.jpg` |
| 命名 | 随机 16 位，禁止使用原始文件名（防路径穿越与信息泄露） |

### 1.9 客户端约定

| 项 | 约定 |
| --- | --- |
| 超时 | 普通请求 15s；上传 60s |
| 重试 | 只对 GET 自动重试（1 次）；POST/PATCH **不得自动重试**（避免重复下单） |
| 幂等 | 写接口不保证幂等，靠 §1.6 去重规则兜底 |
| 并发 | 提交按钮点击后立即禁用（前端），服务端仍做去重校验 |

---

## 2. 公共数据结构

### 2.1 枚举

| 枚举 | 取值 | 前端展示 |
| --- | --- | --- |
| `ServiceType` | `clean` / `other` | 清灰换硅脂 / 其他问题 |
| `CleanTier` | `basic80` / `deep100` | 标准清灰换硅脂 ¥80 / 深度清洁 ¥100 |
| `OtherType` | `screen` / `wifi` / `slow` / `other` | 屏幕故障 / 网络问题 / 系统卡顿 / 其他 |
| `ContactPref` | `phone` / `wechat` | 电话联系 / 微信联系 |
| `ServiceMode` | `shop` / `home` | 到店送修 / 上门服务 |
| `PreferredTime` | `尽快` / `今天` / `明天` / `yyyy-MM-dd HH:mm` | 期望时间 |
| `OrderStatus` | `pending` / `processing` / `done` / `aftersale` / `closed` | 待处理 / 进行中 / 已完成 / 售后 / 已关闭 |
| `AftersaleStatus` | `pending` / `processing` / `closed` | 待处理 / 处理中 / 已关闭 |
| `NotifyStatus` | `pending` / `success` / `failed` | 未发送 / 已通知 / 通知失败 |

### 2.2 `Order`（后台完整对象）

```jsonc
{
  "id": "R20261005-001",
  "serviceType": "clean",
  "cleanTier": "deep100",
  "otherTypes": null,
  "contactName": "张三",
  "phone": "13800000000",
  "contactPref": "wechat",
  "brandModel": "联想 拯救者 Y7000P",
  "modelPhotos": ["/uploads/2026/10/a1b2c3d4e5f6g7h8.jpg"],
  "description": "风扇声音大，玩游戏发烫",
  "serviceMode": "home",
  "preferredTime": "明天下午",
  "address": "XX 小区 X 栋 X 单元",
  "status": "pending",
  "finalPrice": null,
  "remark": "",
  "notifyStatus": "success",
  "createdAt": "2026-10-05T06:30:00.000Z",
  "updatedAt": "2026-10-05T06:30:00.000Z",
  "aftersales": []
}
```

字段类型与取值域以 `docs/api/Xiuxiu_数据库契约_v1.0.md` §3.1 为准（JSON 为 camelCase 映射）。

### 2.3 `Aftersale`

```jsonc
{
  "id": "A20261005-001",
  "phone": "13800000000",
  "orderId": "R20260928-003",
  "inWarranty": true,
  "description": "清灰后风扇声音变大",
  "media": ["/uploads/2026/10/x1y2z3.jpg"],
  "status": "pending",
  "remark": "",
  "notifyStatus": "success",
  "createdAt": "2026-10-05T07:10:00.000Z",
  "updatedAt": "2026-10-05T07:10:00.000Z",
  "order": { "id": "R20260928-003", "serviceType": "clean", "cleanTier": "basic80", "status": "done", "createdAt": "2026-09-28T02:00:00.000Z" }
}
```

### 2.4 `Page<T>`

```jsonc
{ "page": 1, "size": 20, "total": 37, "items": [] }
```

---

## 3. C 端接口

### 3.1 `POST /api/orders` — 提交订单

| 项 | 值 |
| --- | --- |
| 鉴权 | 无 |
| 幂等 | 否（靠去重规则） |
| 对应 PRD | REQ-05 ~ REQ-09、REQ-17 |
| 数据库 | 契约 §3.1 `orders` |

**请求体**

| 字段 | 类型 | 必填 | 校验（与 PRD 字段表一致） | PRD |
| --- | --- | --- | --- | --- |
| `serviceType` | `ServiceType` | 是 | — | A/REQ-05 |
| `cleanTier` | `CleanTier \| null` | 条件 | `serviceType=clean` 时必填；`serviceType=other` 时**可省略（省略视为 `null`），若提供则必须为 `null`**；违反返回 `40001` 且 `data.field=cleanTier` | A1 |
| `otherTypes` | `OtherType[] \| null` | 条件 | `serviceType=other` 时长度 ≥1；`serviceType=clean` 时**可省略（省略视为 `null`），若提供则必须为 `null`**；违反返回 `40001` 且 `data.field=otherTypes` | B1 |
| `contactName` | string | 是 | 1–20 字 | A2 |
| `phone` | string | 是 | `^1[3-9]\d{9}$`，错误文案「请填写正确的 11 位手机号」 | A3 |
| `contactPref` | `ContactPref` | 是 | — | A7 |
| `brandModel` | string | 是 | 1–50 字 | A4 |
| `modelPhotos` | string[] | 否 | ≤3，元素须以 `/uploads/` 开头 | A5 |
| `description` | string \| null | 条件 | ≤300 字；`otherTypes` 含 `other` 时必填 | A6 / B2 |
| `serviceMode` | `ServiceMode` | 是 | — | A8 |
| `preferredTime` | string | 否 | 默认 `尽快`；枚举或 `yyyy-MM-dd HH:mm` | A9 |
| `address` | string \| null | 否 | ≤100 字；仅 `serviceMode=home` 允许非空 | A10 |

**请求示例**

```bash
curl -X POST http://localhost:3000/api/orders \
  -H "Content-Type: application/json" \
  -d '{
    "serviceType": "clean",
    "cleanTier": "basic80",
    "otherTypes": null,
    "contactName": "张三",
    "phone": "13800000000",
    "contactPref": "wechat",
    "brandModel": "联想 拯救者 Y7000P",
    "modelPhotos": [],
    "description": "风扇声音大",
    "serviceMode": "home",
    "preferredTime": "明天下午",
    "address": "XX 小区 X 栋"
  }'
```

**成功响应**

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

| 字段 | 说明 |
| --- | --- |
| `orderId` | 订单号，成功页展示（可长按复制） |
| `etaText` | 联系时效文案：营业时间（9:00–17:00, Asia/Shanghai）内为 30 分钟承诺；否则为「我们会在次日 9:00 后尽快联系您」 |
| `isBusinessHours` | 便于前端切换视觉强调（非营业时间提示更醒目） |

**错误**：`40001` / `40002` / `40003` / `40004` / `50000`

**服务端处理顺序**：Zod 校验（仅类型/必填/长度/枚举/未知字段 → 40001）→ **手机号格式校验（统一 40002，不由 Zod 抛出）** → 10 分钟去重（40003）→ 当日限流（40004）→ 生成单号 → 插入订单 → 推送通知（失败不改订单结果）→ 写 `notification_logs` → 返回。

> **口径说明**：Zod schema 中手机号仅校验非空与长度，**格式错误一律由服务层归一为 40002**，以避免「同一错误两种错误码」。（开工实测后固化）

---

### 3.2 `POST /api/aftersales` — 提交售后报修

| 项 | 值 |
| --- | --- |
| 鉴权 | 无 |
| 对应 PRD | REQ-10、§7.3 |
| 数据库 | 契约 §3.2 `aftersales` |

**请求体**

| 字段 | 类型 | 必填 | 校验 | PRD |
| --- | --- | --- | --- | --- |
| `phone` | string | 是 | 同 §3.1 手机号规则 | C1 |
| `description` | string | 是 | 1–300 字 | C3 |
| `media` | string[] | 否 | ≤3，`/uploads/` 前缀 | C4 |

**成功响应**

```jsonc
{
  "code": 0,
  "message": "ok",
  "data": {
    "aftersaleId": "A20261005-001",
    "matchedOrderId": "R20260928-003",
    "inWarranty": true,
    "etaText": "已收到，我们会尽快联系您核对"
  }
}
```

| 字段 | 说明 |
| --- | --- |
| `matchedOrderId` | 自动匹配到的最近一笔订单号，可为 `null`（查不到不阻止提交，PRD C2） |
| `inWarranty` | 匹配订单在 7 天保修期内为 `true`（**仅提示**，最终由店主判断） |

**错误**：`40001` / `40002` / `40003` / `50000`

> **不与订单状态联动**：`POST /api/aftersales` **不修改** `orders.status`；售后订单状态由店主在后台 `PATCH /api/admin/orders/{id}` 手动置为 `aftersale`（不是提交售后时自动联动）。

---

### 3.3 `GET /api/aftersales/lookup?phone={phone}` — 售后订单自动匹配

| 项 | 值 |
| --- | --- |
| 鉴权 | 无 |
| 触发时机 | 售后页手机号输入完成（失焦 / 11 位输满）时调用 |
| 对应 PRD | C2「输入完成后自动查询最近一笔订单」 |
| 隐私 | **仅返回非敏感摘要**，不返回联系人、地址、故障描述 |

**响应（匹配到）**

```jsonc
{
  "code": 0,
  "message": "ok",
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

**响应（未匹配）**

```jsonc
{ "code": 0, "message": "ok", "data": { "found": false } }
```

| 字段 | 说明 |
| --- | --- |
| `orderDate` | 订单创建日（`Asia/Shanghai`，`yyyy-MM-dd`） |
| `inWarranty` | `orderDate + 7 天 ≥ 今天`（PRD §7.4：交付日起算，当前以订单创建日近似） |
| `warrantyEndDate` | 保修截止日，便于页面展示 |

**错误**：`40002`（手机号格式错误）、`50000`。**查不到订单不是错误**（返回 `found:false`）。

---

### 3.4 `GET /api/orders/{id}` — 成功页摘要（脱敏）

| 项 | 值 |
| --- | --- |
| 鉴权 | 无 |
| 用途 | 成功页刷新 / 用户回看时展示（无此接口则刷新后页面信息丢失） |
| 隐私 | **脱敏**：不返回 `phone`、`contactName`、`address`、`description`、照片 |

**响应**

```jsonc
{
  "code": 0,
  "message": "ok",
  "data": {
    "orderId": "R20261005-001",
    "serviceType": "clean",
    "cleanTier": "basic80",
    "etaText": "我们会在 30 分钟内按您选的方式（电话 / 微信）联系您",
    "createdAt": "2026-10-05T06:30:00.000Z"
  }
}
```

**错误**：`40400`（单号不存在）、`50000`

> 说明：单号含日期与流水，猜中概率低，且返回内容已脱敏；**已定结论：V1 采用脱敏单号查询即可**（不再引入「单号 + 手机号后四位」双因子）。本接口仅用于成功页刷新回看，不提供维修进度自助查询，与 PRD §3.2「不做客户自助查询维修进度」不冲突。

---

### 3.5 `POST /api/upload` — 图片上传

| 项 | 值 |
| --- | --- |
| 鉴权 | 无（受 §1.6 同 IP 限流保护） |
| 请求 | `multipart/form-data`，字段 `file` |
| 校验职责 | 服务端**只校验类型与单张大小**，**不校验表单总张数**（每个表单 3 张由前端限制） |
| 对应 PRD | A5 / B3 / C4、REQ-08 |

**成功响应**

```jsonc
{ "code": 0, "message": "ok", "data": { "url": "/uploads/2026/10/a1b2c3d4e5f6g7h8.jpg", "size": 186342, "width": 1920, "height": 1080 } }
```

**错误**

| code | 场景 |
| --- | --- |
| `40005` | 类型不支持 / 单张超过 5MB / 同 IP 触发限流（阈值见 §1.6，属技术防护非 PRD 验收项） |
| `50000` | 图片处理失败（含 HEIC 解码不可用时返回 `message`：「请改用 JPG/PNG，或在微信中直接发送照片给店主」） |

---

## 4. 后台接口

> 全部需要 `xiuxiu_session` Cookie；未登录统一返回 `40100`。字段含义见数据库契约。

### 4.1 `POST /api/admin/login` — 登录

**请求**：`{ "username": "admin", "password": "******" }`

**成功响应**：`{ "code": 0, "data": { "username": "admin", "expiresAt": "2026-10-05T14:30:00.000Z" } }`（同时 `Set-Cookie: xiuxiu_session=...; HttpOnly; SameSite=Lax; Path=/; Max-Age=28800`）

**错误**：`40001`（账号或密码错误 / 连续失败锁定）、`50000`

> 安全要求：账号不存在与密码错误返回**同一文案**；响应时间保持一致（防用户名枚举）。

### 4.2 `POST /api/admin/logout` — 登出

**响应**：`{ "code": 0, "data": null }`（清除 Cookie）

### 4.3 `GET /api/admin/session` — 当前登录态

**响应**：`{ "code": 0, "data": { "username": "admin", "expiresAt": "..." } }`
**错误**：`40100`（前端路由守卫用）

### 4.4 `GET /api/admin/orders` — 订单列表

**查询参数**

| 参数 | 类型 | 默认 | 说明 |
| --- | --- | --- | --- |
| `status` | `OrderStatus` | 全部 | 状态筛选 |
| `phone` | string | — | 手机号精确搜索（PRD §6.2「可按电话搜索」） |
| `notifyStatus` | `NotifyStatus` | — | 用于筛出「通知失败」订单（漏单兜底） |
| `from` / `to` | `yyyy-MM-dd` | — | 下单时间范围（Asia/Shanghai，含首尾） |
| `page` / `size` | number | 1 / 20 | 见 §1.7 |

**响应**：`Page<Order>`（列表项含全部字段，便于表格直接渲染；体积可控：单条 <2KB）

### 4.5 `GET /api/admin/orders/{id}` — 订单详情

**响应**：`{ "code": 0, "data": { ...Order, "aftersales": [Aftersale...] } }`
**错误**：`40400`

### 4.6 `PATCH /api/admin/orders/{id}` — 改状态 / 备注 / 最终价格

**请求体**（至少一项）

| 字段 | 类型 | 校验 |
| --- | --- | --- |
| `status` | `OrderStatus` | 必须符合状态流转矩阵（数据库契约 §5）；命中标 ⚠️「需备注」的流转时必须同时提交非空 `remark`，否则 `40006` |
| `remark` | string | ≤500 字；命中 ⚠️「需备注」或回退时**本次请求必须携带非空 remark**（历史已有备注不算） |
| `finalPrice` | string \| null | `"80.00"` 形式，∈ [0, 999999.99] |

**请求示例**：`{ "status": "done", "remark": "9/30 已交付，收 100 元", "finalPrice": "100.00" }`

**响应**：`{ "code": 0, "data": { ...更新后的 Order } }`

**错误**：`40001`（校验失败）、`40006`（非法流转，或命中数据库契约 §5 矩阵中标 ⚠️「需备注」的流转但 `remark` 为空）、`40400`

### 4.7 `GET /api/admin/aftersales` — 售后列表

**查询参数**：`status`、`phone`、`page`、`size`（同 §4.4）

**响应**：`Page<Aftersale>`（`order` 关联摘要一并返回，便于列表直接显示「关联订单」）

### 4.8 `GET /api/admin/aftersales/{id}` — 售后详情

**响应**：`{ "code": 0, "data": Aftersale }`；**错误**：`40400`

### 4.9 `PATCH /api/admin/aftersales/{id}` — 处理售后

**请求体**：`{ "status": "processing" | "closed" | "pending", "remark": "..." }`
**约束**：流转符合 `pending → processing → closed`（允许 `processing → pending` 回退）
**错误**：`40001` / `40006` / `40400`

### 4.10 `GET /api/admin/export` — 导出 CSV

| 参数 | 值 | 说明 |
| --- | --- | --- |
| `type` | `orders` \| `aftersales` | 必填 |
| `status` / `from` / `to` | 同 §4.4 | 可选筛选 |

| 项 | 约定 |
| --- | --- |
| 响应头 | `Content-Type: text/csv; charset=utf-8`；`Content-Disposition: attachment; filename="orders_20261005.csv"` |
| 编码 | UTF-8 + BOM（Excel 双击不乱码） |
| 列（订单） | 单号、下单时间、服务类型、套餐、问题类型、联系人、电话、联系偏好、机型、照片数、服务方式、期望时间、地址、状态、最终价格、备注、通知状态 |
| 列（售后） | 售后单号、提交时间、手机号、关联订单、保修期内、问题描述、照片数、状态、备注、通知状态 |
| 转义 | 含逗号/引号/换行的字段用双引号包裹，内部引号转义为 `""` |
| 上限 | 单次最多导出 10000 行（超出提示缩小时间范围） |

### 4.11 `GET /api/admin/stats` — 简单统计（可选）

**响应**：`{ "code": 0, "data": { "todayOrders": 3, "weekDone": 12, "pendingCount": 2, "notifyFailedCount": 0 } }`

---

## 5. 状态流转与接口的对应关系

```
下单 ──► pending ──(后台改)──► processing ──► done ──► aftersale ──► closed
             │                     │            │           │
             └─────────────────────┴────────────┴───────────┴──► closed
```

| 操作 | 接口 | 允许的目标状态 |
| --- | --- | --- |
| 新建订单 | `POST /api/orders` | 固定 `pending`（客户端**不可**指定状态） |
| 开始处理 | `PATCH /api/admin/orders/{id}` | `processing` |
| 完成 | 同上 | `done` |
| 进入售后 | 同上 | `aftersale` |
| 关闭 | 同上 | `closed` |
| 回退 | 同上 | 任意前序状态；回退及矩阵中标 ⚠️「需备注」的流转**必须由本次请求携带非空 `remark`**（历史备注不计入），否则返回 `40006` |

> **口径补充（开工实测后固化）**：`closed` 视为**订单终态**，`closed → processing/done` 属 ⚠️（需备注）以外的非法组合一律 40006；售后状态矩阵仅定义 `pending → processing → closed`（允许 `processing → pending` 回退），其余组合一律 40006。

> **状态机权威**：以数据库契约 §5 矩阵为准。非法流转，**或**命中矩阵中标 ⚠️「需备注」的流转但 `remark` 为空 → 均返回 `40006`。

> 客户端提交订单时**不接受** `status`、`notifyStatus`、`finalPrice`、`remark` 字段（Zod strict 会直接拒绝），防止越权写入。

---

## 6. 调用时序

### 6.1 下单

```
客户          前端                     服务端                       通知通道
 │   填表提交   │                        │                             │
 │─────────────►│  POST /api/orders      │                             │
 │              │───────────────────────►│ Zod 校验                     │
 │              │                        │ 手机号校验(40002)            │
 │              │                        │ 10 分钟去重(40003)           │
 │              │                        │ 当日 5 单限流(40004)         │
 │              │                        │ 生成单号 → INSERT orders      │
 │              │                        │ 组装模板 → POST webhook ─────►│
 │              │                        │ 写 notification_logs          │
 │              │  200 {orderId,etaText} │ 更新 notify_status            │
 │              │◄───────────────────────│                             │
 │  展示成功页  │                        │                             │
```

### 6.2 售后

```
客户           前端                       服务端
 │ 输入手机号   │  GET /aftersales/lookup    │
 │─────────────►│───────────────────────────►│ 取最近一单 → 算 7 天保修
 │              │◄───────────────────────────│
 │              │ 展示「已找到您的订单 / 保修期内」
 │ 提交报修     │  POST /api/aftersales      │
 │─────────────►│───────────────────────────►│ 再匹配一次（防状态变化）→ INSERT → 通知
 │              │◄───────────────────────────│
```

### 6.3 后台处理

```
店主          后台页面                    服务端
 │ 打开列表    │  GET /admin/orders         │
 │────────────►│───────────────────────────►│ 分页 + 状态/电话筛选
 │ 打开详情    │  GET /admin/orders/{id}    │
 │ 改状态/备注 │  PATCH /admin/orders/{id}  │ 校验流转(40006) → 回写 updated_at
 │ 导出        │  GET /admin/export?type=orders
```

---

## 7. 错误提示与前端展示规范

| 错误来源 | 展示位置 | 要求 |
| --- | --- | --- |
| 字段级校验（`40001`/`40002`） | 响应 `data.field` / `data.fields` 定位，展示在对应字段下方（Footnote 级红字） | 不改变字段行高；滚动并聚焦首个错误字段 |
| 去重 / 限流（`40003`/`40004`） | 顶部 Toast | **保留已填内容**，不跳页 |
| 上传错误（`40005`） | 上传组件内 | 指出具体原因（类型 / 单张大小 / 同 IP 限流） |
| 状态流转（`40006`） | 顶部 Toast 或备注字段下方 | 提示「当前状态不允许此操作」；`remark` 缺失时定位到备注字段 |
| 会话失效（`40100`） | 跳转 `/admin/login` | 携带 `?redirect=` 便于登录后回到原页 |
| 记录不存在（`40400`） | 页面内空态 | 提供「返回列表」按钮 |
| 服务端异常（`50000`） | 顶部 Toast | 必须包含电话 `18029516310`（PRD REQ-09 指定文案） |

### 7.1 PRD 指定字段级文案登记

> 以下文案由服务端在 `message` 中原样返回，前端**不得改写语义**。字段级错误同时通过 `data.field` / `data.fields` 给出定位信息（见 §1.3）。

| 来源 | 字段 / 场景 | 文案 |
| --- | --- | --- |
| PRD A2 | `contactName` 未填写 | 请填写联系人姓名 |
| PRD B1 | `otherTypes` 未选择（长度 <1） | 请至少选择一个问题类型 |
| PRD A3 | `phone` 格式错误 | 请填写正确的 11 位手机号 |
| PRD §5.2.4 | 同手机号当日超过 5 单（`40004`） | 提交过于频繁，请直接电话 18029516310 或加官方微信 |
| PRD §4.2.7 | 服务端异常（`50000`） | 提交失败，请重试或直接拨打 18029516310 |

---

## 8. 联调与验证

### 8.1 冒烟脚本（本地）

```bash
BASE=http://localhost:3000

# 1. 提交订单
curl -s -X POST $BASE/api/orders -H 'Content-Type: application/json' -d '{
  "serviceType":"clean","cleanTier":"basic80","otherTypes":null,"contactName":"张三",
  "phone":"13800000000","contactPref":"phone","brandModel":"联想 Y7000P",
  "modelPhotos":[],"description":"风扇声音大","serviceMode":"shop","preferredTime":"尽快","address":null}'

# 2. 立即重复提交 → 期望 code=40003
# 3. 座机号 → 期望 code=40002
curl -s -X POST $BASE/api/orders -H 'Content-Type: application/json' -d '{
  "serviceType":"clean","cleanTier":"basic80","otherTypes":null,"contactName":"李四",
  "phone":"07541234567","contactPref":"phone","brandModel":"X","modelPhotos":[],
  "description":null,"serviceMode":"shop","preferredTime":"尽快","address":null}'

# 4. 售后匹配
curl -s "$BASE/api/aftersales/lookup?phone=13800000000"

# 5. 后台未登录 → 期望 HTTP 401 / code=40100
curl -s -o /dev/null -w '%{http_code}\n' $BASE/api/admin/orders

# 6. 登录并带 Cookie 访问
curl -s -c /tmp/ck.txt -X POST $BASE/api/admin/login -H 'Content-Type: application/json' \
  -d '{"username":"admin","password":"你的密码"}'
curl -s -b /tmp/ck.txt "$BASE/api/admin/orders?page=1&size=20"
curl -s -b /tmp/ck.txt "$BASE/api/admin/export?type=orders" -o /tmp/orders.csv && head -2 /tmp/orders.csv
```

### 8.2 契约测试建议（可选）

| 层级 | 内容 |
| --- | --- |
| Schema 测试 | 校验每个响应符合本文档结构（可用 `openapi.yaml` + 校验器） |
| 边界测试 | 手机号边界（10/11/12 位、非 1 开头、座机）、描述 300/301 字、照片 3/4 张、金额边界 |
| 状态机测试 | 遍历流转矩阵中所有 ✅/⚠️/非法组合 |
| 去重测试 | 同内容 10 分钟内 2 次、第 11 分钟再提交 |
| 鉴权测试 | 无 Cookie / 过期 Cookie / 篡改 Cookie |

---

## 9. 附录

### 9.1 文件清单

| 文件 | 说明 |
| --- | --- |
| `docs/api/Xiuxiu_API契约_v1.0.md` | 本文档（权威） |
| `docs/api/Xiuxiu_数据库契约_v1.0.md` | 数据库结构、取值域、不变量、迁移规则 |
| `docs/api/openapi.yaml` | OpenAPI 3.1 规格，可导入 Postman / Swagger UI / 生成前端类型 |

### 9.2 字段命名映射示例

| JSON（camelCase） | 数据库（snake_case） |
| --- | --- |
| `serviceType` | `service_type` |
| `cleanTier` | `clean_tier` |
| `otherTypes` | `other_types` |
| `contactPref` | `contact_pref` |
| `brandModel` | `brand_model` |
| `modelPhotos` | `model_photos` |
| `serviceMode` | `service_mode` |
| `preferredTime` | `preferred_time` |
| `notifyStatus` | `notify_status` |
| `createdAt` / `updatedAt` | `created_at` / `updated_at` |
| `contactName` | `contact_name` |
| `finalPrice` | `final_price` |
| `orderId` | `order_id` |
| `aftersaleId` | `aftersale_id` |
| `inWarranty` | `in_warranty` |

### 9.3 待确认项（与开发文档 §11.2 联动）

| # | 事项 | 结论 / 建议 |
| --- | --- | --- |
| 1 | 成功页摘要接口（§3.4）查询方式 | **已定结论**：V1 用脱敏单号查询即可（不引入「单号 + 手机号后四位」双因子） |
| 2 | 上传接口 IP 限流阈值 | **已定**：由配置项 `UPLOAD_RATE_LIMIT_PER_HOUR` 控制（默认 30），属技术防护，非 PRD 验收项 |
| 3 | 登录失败锁定（5 次/10 分钟）是否启用 | 建议启用 |
| 4 | 导出上限 10000 行 | 建议保持 |

---

*文档结束。接口行为变更以本文档为准；数据库结构变更见 `docs/api/Xiuxiu_数据库契约_v1.0.md`。*
