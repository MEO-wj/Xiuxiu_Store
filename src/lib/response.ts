/**
 * 统一响应构造器（API 契约 §1.3）。
 *
 * 用法（T6/T7 路由层）：
 *   return NextResponse.json(ok(data));
 *   return NextResponse.json(fail(ErrorCode.INVALID_PHONE), { status: 400 });
 *
 * 服务层（order-service / aftersale-service）抛出 ServiceError，由路由层
 * 转 HTTP 响应（本文件提供便捷转换）。
 */
import { ERROR_HTTP_STATUS, ERROR_MESSAGES, ErrorCode } from "./constants";
import type { ApiErr, ApiOk, FieldError } from "./types";

/** 成功响应 */
export function ok<T>(data: T): ApiOk<T> {
  return { code: 0, message: "ok", data };
}

/**
 * 失败响应（非字段级：data 为 null）。
 * message 缺省取错误码登记文案（契约 §1.4）。
 */
export function fail(code: number, message?: string): ApiErr {
  return { code, message: message ?? ERROR_MESSAGES[code] ?? "请求失败", data: null };
}

/** 字段级失败响应（40001/40002：data 携带 field / fields 定位，契约 §1.3） */
export function failWithFields(code: number, fields: FieldError[], message?: string): ApiErr {
  const first = fields[0];
  return {
    code,
    message: message ?? first?.message ?? ERROR_MESSAGES[code] ?? "请求失败",
    data: first ? { field: first.field, fields } : null,
  };
}

/** 单字段失败（语法糖） */
export function failWithField(code: number, field: string, message: string): ApiErr {
  return { code, message, data: { field, fields: [{ field, message }] } };
}

/** 错误码对应 HTTP 状态（契约 §1.4 表） */
export function httpStatusOf(code: number): number {
  return ERROR_HTTP_STATUS[code] ?? 500;
}

/**
 * 服务层错误：路由层捕获后一次性转统一响应。
 * code 必须取自 ErrorCode（禁止自创错误码）。
 */
export class ServiceError extends Error {
  readonly code: number;
  readonly fields?: FieldError[];

  constructor(code: number, message?: string, fields?: FieldError[]) {
    super(message ?? ERROR_MESSAGES[code] ?? "请求失败");
    this.name = "ServiceError";
    this.code = code;
    this.fields = fields;
  }

  /** 转统一响应体（字段级错误自动携带 field/fields） */
  toResponse(): ApiErr {
    if (this.fields && this.fields.length > 0) {
      return failWithFields(this.code, this.fields, this.message);
    }
    return fail(this.code, this.message);
  }

  /** 转 HTTP 响应需要的 status */
  get httpStatus(): number {
    return httpStatusOf(this.code);
  }
}

/** Zod 校验失败 → 40001 字段级响应（message 取首个 issue 文案，契约 §1.2） */
export function zodFail(fields: FieldError[]): ApiErr {
  return failWithFields(ErrorCode.BAD_REQUEST, fields);
}

/** 未知异常 → 50000（文案含联系电话，契约 §1.4） */
export function internalFail(): ApiErr {
  return fail(ErrorCode.INTERNAL);
}
