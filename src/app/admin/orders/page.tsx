"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminNav";
import { ServiceTags, StatusBadge } from "@/components/admin/StatusBadge";
import { Skeleton } from "@/components/ui";
import { ORDER_STATUS_LABELS } from "@/lib/constants";
import type { OrderDTO, Page } from "@/lib/types";

const STATUS_OPTIONS = ["pending", "processing", "done", "aftersale", "closed"] as const;

export default function AdminOrdersPage() {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [phone, setPhone] = useState("");
  const [notifyFailedOnly, setNotifyFailedOnly] = useState(false);
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page<OrderDTO> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const qs = new URLSearchParams({ page: String(page), size: "20" });
    if (status) qs.set("status", status);
    if (phone) qs.set("phone", phone);
    if (notifyFailedOnly) qs.set("notifyStatus", "failed");
    try {
      const res = await fetch(`/api/admin/orders?${qs}`);
      const body = await res.json();
      if (res.status === 401 || body.code === 40100) {
        router.replace("/admin/login?redirect=/admin/orders");
        return;
      }
      if (body.code !== 0) {
        setError(body.message ?? "加载失败");
        return;
      }
      setData(body.data);
    } catch {
      setError("网络异常，请重试");
    } finally {
      setLoading(false);
    }
  }, [page, status, phone, notifyFailedOnly, router]);

  useEffect(() => {
    void load();
  }, [load]);

  const exportHref = `/api/admin/export?type=orders${status ? `&status=${status}` : ""}`;

  return (
    <div className="pb-10 desktop:mx-auto desktop:max-w-[64rem]">
      <AdminNav />

      <div className="flex flex-wrap items-center gap-2 px-4 py-3 tablet:flex-nowrap tablet:px-6">
        <select
          value={status}
          onChange={(e) => {
            setPage(1);
            setStatus(e.target.value);
          }}
          className="h-9 rounded-[var(--radius-input)] bg-white px-2 text-[13px] outline-none ring-1 ring-[var(--color-separator)]"
          aria-label="按状态筛选"
        >
          <option value="">全部状态</option>
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>
              {ORDER_STATUS_LABELS[s]}
            </option>
          ))}
        </select>

        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
          placeholder="手机号搜索"
          inputMode="tel"
          className="h-9 w-[140px] rounded-[var(--radius-input)] bg-white px-2 text-[13px] outline-none ring-1 ring-[var(--color-separator)] tablet:w-[180px]"
          aria-label="按手机号搜索"
        />

        <button
          type="button"
          onClick={() => {
            setPage(1);
            setNotifyFailedOnly((v) => !v);
          }}
          className={`h-9 rounded-[var(--radius-input)] px-3 text-[13px] ${
            notifyFailedOnly ? "bg-[var(--color-danger)] text-white" : "bg-white ring-1 ring-[var(--color-separator)]"
          }`}
        >
          仅看通知失败
        </button>

        <button type="button" onClick={() => { setPage(1); void load(); }} className="h-9 rounded-[var(--radius-input)] bg-white px-3 text-[13px] ring-1 ring-[var(--color-separator)]">
          刷新
        </button>

        <a href={exportHref} className="ml-auto flex h-9 items-center rounded-[var(--radius-input)] bg-[var(--color-primary)] px-3 text-[13px] font-medium text-white">
          导出 CSV
        </a>
      </div>

      {error ? <p className="px-4 pb-2 text-[13px] text-[var(--color-danger)] tablet:px-6">⚠ {error}</p> : null}

      {loading && !data ? (
        <div className="space-y-2 px-4 tablet:px-6">
          <Skeleton variant="rect" className="h-16" />
          <Skeleton variant="rect" className="h-16" />
          <Skeleton variant="rect" className="h-16" />
        </div>
      ) : null}

      {data && data.items.length === 0 ? (
        <p className="px-4 py-8 text-center text-[13px] text-[var(--color-label-2)] tablet:px-6">暂无订单</p>
      ) : null}

      <ul className="divide-y divide-[var(--color-separator)] bg-white">
        {data?.items.map((order) => {
          const failed = order.notifyStatus === "failed";
          return (
            <li key={order.id} className={failed ? "bg-[rgba(239,68,68,.06)]" : undefined}>
              <Link href={`/admin/orders/${order.id}`} className="flex flex-col gap-1 px-4 py-3 hover:bg-[var(--color-fill)] tablet:px-6">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[13px] font-semibold">{order.id}</span>
                  <StatusBadge status={order.status} />
                  {failed ? <span className="text-[12px] font-semibold text-[var(--color-danger)]">通知失败</span> : null}
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[var(--color-label-2)]">
                  <span className="text-[var(--color-label)]">
                    {order.contactName} · {order.phone}
                  </span>
                  <span>{order.serviceType === "clean" ? `清灰换硅脂 ${order.cleanTier === "deep100" ? "深度清洁 ¥100" : "标准 ¥80"}` : `其他问题 ${(order.otherTypes ?? []).join("/")}`}</span>
                  <ServiceTags serviceMode={order.serviceMode} contactPref={order.contactPref} />
                  <span>{new Date(order.createdAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })}</span>
                </div>
              </Link>
            </li>
          );
        })}
      </ul>

      {data && data.total > 0 ? (
        <div className="flex items-center justify-center gap-3 px-4 py-4 text-[13px] tablet:px-6">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => p - 1)} className="h-8 rounded-md bg-white px-3 ring-1 ring-[var(--color-separator)] disabled:opacity-40">
            上一页
          </button>
          <span className="text-[var(--color-label-2)]">
            第 {data.page} 页 · 共 {data.total} 条
          </span>
          <button
            type="button"
            disabled={page * data.size >= data.total}
            onClick={() => setPage((p) => p + 1)}
            className="h-8 rounded-md bg-white px-3 ring-1 ring-[var(--color-separator)] disabled:opacity-40"
          >
            下一页
          </button>
        </div>
      ) : null}
    </div>
  );
}
