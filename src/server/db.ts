/**
 * PrismaClient 单例（dev 热重载安全，开发文档 §2.2）。
 *
 * Next.js dev 下模块会被反复重新加载，若每次 new PrismaClient 会耗尽连接池；
 * 通过 globalThis 缓存复用实例（Prisma 官方推荐模式）。
 */
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
