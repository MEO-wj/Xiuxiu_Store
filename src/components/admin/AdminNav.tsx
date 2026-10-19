"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const TABS = [
  { href: "/admin/orders", label: "订单" },
  { href: "/admin/aftersales", label: "售后" },
];

export function AdminNav() {
  const pathname = usePathname();
  const router = useRouter();

  async function logout() {
    await fetch("/api/admin/logout", { method: "POST" });
    router.push("/admin/login");
  }

  return (
    <header className="sticky top-0 z-40 border-b border-[var(--color-separator)] bg-white">
      <div className="mx-auto flex h-12 w-full max-w-[64rem] items-center gap-4 px-4 tablet:px-6">
        <span className="text-sm font-semibold">xiu xiu 后台</span>
        <nav className="flex items-center gap-1">
          {TABS.map((tab) => {
            const active = pathname.startsWith(tab.href);
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={`rounded-md px-3 py-1.5 text-sm ${
                  active ? "bg-[var(--color-primary-soft)] font-semibold text-[var(--color-primary)]" : "text-[var(--color-label-2)]"
                }`}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>
        <button type="button" onClick={logout} className="ml-auto rounded-md px-3 py-1.5 text-sm text-[var(--color-label-2)] hover:bg-[var(--color-fill)]">
          退出登录
        </button>
      </div>
    </header>
  );
}
