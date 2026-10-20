import Link from "next/link";
import { clsx } from "clsx";
import type { ReactNode } from "react";
import { ChevronLeftIcon } from "./icons";

export type NavBarProps = { title: string; backHref?: string | null; backLabel?: string; right?: ReactNode; className?: string };

export function NavBar({ title, backHref = "/", backLabel = "返回首页", right, className }: NavBarProps) {
  return <header className={clsx("flow-nav glass-bar", className)}><div className="page-width flow-nav-inner">
    <div className="flex min-w-0 items-center gap-2">
      {backHref && <Link href={backHref} aria-label={backLabel} className="flow-back"><ChevronLeftIcon className="size-5" /></Link>}
      <Link href="/" className="brand"><span className="brand-mark" aria-hidden="true">x</span><span className="hidden tablet:inline">xiu xiu</span></Link>
      <span className="nav-divider" /><span className="truncate text-[0.9375rem] font-medium">{title}</span>
    </div>
    <div className="flex shrink-0 items-center gap-4">{right}<Link href="/aftersale" className="nav-support">售后帮助</Link></div>
  </div></header>;
}
