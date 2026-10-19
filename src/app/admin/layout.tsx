export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-dvh bg-[var(--color-bg)] text-[14px] text-[var(--color-label)]">{children}</div>;
}
