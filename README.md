# XiuXiu_Store

电脑维修派单接单系统 —— 用户下单支付、后台派单、维修员接单。

当前仓库仅包含**目录骨架**，暂无任何代码与文档内容。

## 目录结构

```text
XiuXiu_Store/
├── README.md
├── .gitignore
├── .editorconfig
├── .gitattributes
│
├── docs/                       # 项目文档
│   ├── prd/                    # 需求文档（PRD）
│   ├── plan/                   # 开发计划文档
│   └── api/                    # 接口文档
│
├── frontend/                   # 前端（多端）
│   ├── user-web/               # 用户端 · Web（客户 + 维修员，按角色区分权限）
│   ├── user-app/               # 用户端 · App（客户 + 维修员，同一角色体系）
│   └── admin-web/              # 运营管理后台（仅内网 IP 访问，不对外开放）
│
├── backend/                    # 后端服务
│   ├── db/                     # 建表 / 初始化脚本
│   └── src/
│       ├── main/
│       │   ├── java/com/repair/
│       │   │   ├── common/     # 通用：响应体、异常、枚举、工具
│       │   │   ├── config/     # 框架配置
│       │   │   ├── security/   # 认证鉴权
│       │   │   └── modules/    # 业务模块
│       │   │       ├── auth/         # 登录认证
│       │   │       ├── user/         # 账号 / 角色 / 权限
│       │   │       ├── customer/     # 客户与地址
│       │   │       ├── service/      # 服务分类与项目
│       │   │       ├── order/        # 订单主流程
│       │   │       ├── payment/      # 支付与退款
│       │   │       ├── dispatch/     # 派单
│       │   │       ├── technician/   # 维修员
│       │   │       ├── notify/       # 消息通知
│       │   │       └── admin/        # 后台管理接口
│       │   └── resources/
│       │       ├── mapper/           # MyBatis XML
│       │       ├── db/migration/     # 数据库版本脚本
│       │       └── i18n/             # 国际化
│       └── test/java/com/repair/     # 测试
│
├── deploy/                     # 部署运维（Docker）
│   ├── docker/
│   ├── nginx/
│   └── scripts/
│
└── .github/
    ├── workflows/              # CI/CD
    └── ISSUE_TEMPLATE/
```

## 前端子结构

```text
frontend/user-web/               # 用户端 Web：客户 + 维修员共用，按角色控制可见内容
└── src/
    ├── api/            # 接口请求封装
    ├── assets/         # 静态资源
    ├── components/     # 公共组件
    ├── directives/     # 按钮级权限指令（v-perm）
    ├── layout/         # 页面布局（按角色切换导航）
    ├── permission/     # 角色判断、路由守卫、菜单过滤
    ├── router/         # 路由（按角色动态注册）
    ├── store/          # 状态管理（用户 / 角色 / 权限）
    ├── styles/         # 全局样式
    ├── utils/          # 工具函数
    └── views/
        ├── common/     # 登录、协议、404 等公共页
        ├── customer/   # 客户视角
        │   ├── home/       # 首页
        │   ├── service/    # 服务列表与详情
        │   ├── order/      # 下单 / 支付 / 我的订单
        │   └── profile/    # 个人中心
        └── technician/ # 维修员视角
            ├── workbench/  # 接单工作台（待接单 / 进行中）
            ├── order/      # 我的工单、维修记录、维修报告
            └── profile/    # 个人资料 / 技能 / 收益

frontend/user-app/               # 用户端 App：客户 + 维修员共用，同一套角色体系
└── src/
    ├── api/
    ├── components/
    ├── directives/     # 按钮级权限指令
    ├── pages/
    │   ├── common/     # 登录、协议
    │   ├── customer/   # 客户视角
    │   │   ├── home/       # 首页
    │   │   ├── service/    # 服务浏览与下单
    │   │   ├── order/      # 订单列表与详情
    │   │   └── profile/    # 个人中心
    │   └── technician/ # 维修员视角
    │       ├── workbench/  # 接单工作台
    │       ├── order/      # 我的工单与维修记录
    │       └── profile/    # 个人资料 / 收益
    ├── permission/     # 角色判断与路由拦截
    ├── static/
    ├── store/
    ├── styles/
    └── utils/

frontend/admin-web/              # 运营管理后台（仅后台人员）
└── src/
    ├── api/
    ├── assets/
    ├── components/
    ├── layout/         # 后台布局
    ├── router/
    ├── store/
    ├── styles/
    ├── utils/
    └── views/
        ├── dashboard/  # 工作台
        ├── order/      # 订单管理
        ├── dispatch/   # 派单管理
        ├── service/    # 服务管理
        ├── technician/ # 维修员管理
        ├── customer/   # 客户管理
        ├── finance/    # 财务
        └── system/     # 系统权限
```

## 角色与端

| 角色 | 端 | 访问方式 |
| --- | --- | --- |
| 客户 | `frontend/user-web` / `frontend/user-app` | 对外公开 |
| 维修员 | `frontend/user-web` / `frontend/user-app`（**同一端，不同角色**） | 账号由后台开通后登录 |
| 派单员 / 管理员 / 财务 | `frontend/admin-web` | **仅内网 IP 访问，不对外开放** |
| 服务端 | `backend` | 见下方访问控制 |

## 端与访问范围

| 端 | 状态 | 说明 |
| --- | --- | --- |
| 用户 Web 端 `user-web` | 本期实现 | 客户下单 + 维修员接单，对外公开 |
| 用户 App 端 `user-app` | 本期实现 | 客户下单 + 维修员接单，打包分发 |
| 管理后台 `admin-web` | 本期实现 | **仅后台人员通过独立 IP / 域名访问，不对外解析、不对外开放** |
| 用户小程序 | 暂缓（仅评估） | 后续视业务需要再立项，暂不建目录 |

## 同一前端内的角色隔离

用户端 Web / App **不区分部署**，登录后根据身份展示不同内容：

| 角色 | 可见范围 |
| --- | --- |
| 客户 `CUSTOMER` | 首页、服务浏览、下单支付、我的订单、评价、个人中心 |
| 维修员 `TECHNICIAN` | 接单工作台、我的工单、维修记录/报告、收益、个人资料 |
| 双重身份 | 可在个人中心切换「客户 / 维修员」视图 |

实现要点：

1. 同一登录入口，签发 token 时携带角色与权限码。
2. 路由按角色**动态注册**，无权路由不可访问（非仅隐藏菜单）。
3. `permission/` 负责守卫与菜单过滤，`directives/` 提供按钮级 `v-perm` 控制。
4. 后端接口按角色鉴权，前端隐藏仅为体验优化，**不作为安全边界**。

## 管理后台隔离要求

管理后台不对外开放，需在部署层保证：

1. 独立域名或独立 IP，DNS 不做公网解析（或仅解析到内网）。
2. Nginx 层配置 `allow` / `deny` IP 白名单，仅放行办公网出口 IP。
3. 后台接口 `/api/v1/admin/**` 单独做 IP 白名单 + 独立鉴权，与会话隔离。
4. 不与用户端共用对外暴露的网关路由；必要时通过 VPN / 跳板机访问。
