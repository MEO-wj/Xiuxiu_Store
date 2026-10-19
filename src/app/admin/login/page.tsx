"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const body = await res.json();
      if (body.code !== 0) {
        setError(body.message ?? "登录失败");
        return;
      }
      router.replace(params.get("redirect") ?? "/admin/orders");
    } catch {
      setError("网络异常，请重试");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center bg-[var(--color-surface-dark)] px-4 tablet:px-8">
      <form onSubmit={submit} className="w-full max-w-[360px] rounded-[var(--radius-card)] bg-white p-5">
        <h1 className="text-lg font-semibold">xiu xiu 后台</h1>
        <p className="mb-4 mt-1 text-[13px] text-[var(--color-label-2)]">仅店主使用，请用管理员账号登录</p>

        <label className="mb-1 block text-[13px] text-[var(--color-label-2)]" htmlFor="username">
          账号
        </label>
        <input
          id="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          className="mb-3 h-11 w-full rounded-[var(--radius-input)] bg-[var(--color-fill)] px-3 text-[14px] outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-primary)]"
        />

        <label className="mb-1 block text-[13px] text-[var(--color-label-2)]" htmlFor="password">
          密码
        </label>
        <input
          id="password"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          className="mb-3 h-11 w-full rounded-[var(--radius-input)] bg-[var(--color-fill)] px-3 text-[14px] outline-none focus-visible:ring-1 focus-visible:ring-[var(--color-primary)]"
        />

        {error ? <p className="mb-3 text-[13px] text-[var(--color-danger)]">⚠ {error}</p> : null}

        <Button type="submit" variant="primary" block loading={loading} loadingText="登录中…">
          登录
        </Button>
      </form>
    </div>
  );
}

export default function AdminLoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
