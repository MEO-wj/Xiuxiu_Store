# prisma/ 说明

数据库契约（唯一权威）：`docs/api/Xiuxiu_数据库契约_v1.0.md`。本目录下的 `schema.prisma` 必须与契约 §13 保持一致，任何变更先改契约再改模型（契约 §0 变更规则）。

## 文件

| 文件 | 说明 |
| --- | --- |
| `schema.prisma` | 四个模型（Order / Aftersale / AdminUser / NotificationLog），与契约 §13 逐字段一致 |
| `seed.ts` | 幂等种子脚本（upsert），支持 `SEED_MODE=demo`（管理员 + 演示数据）/ `SEED_MODE=admin`（仅管理员，生产用） |
| `migrations/` | **开发期为空**（用 `prisma db push` 快速同步）；上线前切换为版本化迁移 |

## 常用命令

```bash
pnpm db:up      # 启动本地 PostgreSQL 16（docker compose）
pnpm db:push    # 开发期建表/同步结构（prisma db push）
pnpm db:seed    # 写入种子数据（幂等，可重复执行）
pnpm db:studio  # 可视化查看数据
```

## ⚠️ 生产迁移规则（契约 §9）

1. **生产只能用 `prisma migrate deploy`（`pnpm db:migrate:deploy`），禁止 `prisma db push`**。
2. **GIN 索引 `idx_orders_other_types` 需在迁移 SQL 中手工创建**（Prisma 无法声明 GIN 索引，契约 §3.1/§12 已定义）：

   ```sql
   CREATE INDEX idx_orders_other_types ON orders USING GIN (other_types);
   ```

   生成首个迁移后，把上面语句追加进 `migration.sql`，并附回滚注释：

   ```sql
   -- 回滚：DROP INDEX IF EXISTS idx_orders_other_types;
   ```

   说明：该索引为可选（用于按问题类型筛选）；若确认不使用该筛选可暂不创建（契约 §3.1）。
3. 迁移文件命名：`prisma/migrations/<时间戳>_<语义描述>/migration.sql`，文件内必须包含等价回滚说明（注释形式）。
4. 破坏性变更走三步走流程（新增可空列 → 双写 → 回填确认后删旧列），生产执行前必须 `pg_dump` 备份。
