import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";
import { SESSION_COOKIE } from "@/lib/constants";

/**
 * /admin/* 会话保护（契约 §4.3）。
 * middleware 运行在 Edge 运行时：只校验 JWT 签名与过期，不访问数据库。
 */
export async function middleware(req: NextRequest) {
  const { pathname, search } = req.nextUrl;
  if (pathname.startsWith("/admin/login")) return NextResponse.next();

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (token) {
    try {
      const secret = new TextEncoder().encode(process.env.SESSION_SECRET ?? "");
      await jwtVerify(token, secret, { algorithms: ["HS256"] });
      return NextResponse.next();
    } catch {
      /* 无效或过期 → 走重定向 */
    }
  }

  const loginUrl = new URL("/admin/login", req.url);
  loginUrl.searchParams.set("redirect", `${pathname}${search}`);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/admin/:path*"],
};
