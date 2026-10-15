import { Decimal } from "@prisma/client/runtime/library";

/**
 * 金额工具（服务端专用，数据库契约 §1：金额用 NUMERIC(10,2)，禁浮点）。
 * 放在 server 层是因为需要 Prisma Decimal；客户端请只消费已序列化的字符串。
 */

/** Decimal | number | string → 两位小数字符串（如 "100.00"）。用于序列化与展示。 */
export function formatPrice(value: Decimal | number | string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const d = value instanceof Decimal ? value : new Decimal(value);
  return d.toFixed(2);
}

/** 校验金额字符串 ∈ [0, 999999.99]（数据库契约 I6；Decimal 运算，禁浮点） */
export function isValidPriceString(value: string): boolean {
  try {
    const d = new Decimal(value);
    return d.greaterThanOrEqualTo(0) && d.lessThanOrEqualTo(999999.99);
  } catch {
    return false;
  }
}
