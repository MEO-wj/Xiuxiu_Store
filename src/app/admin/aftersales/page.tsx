"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminNav";
import { StatusBadge } from "@/components/admin/StatusBadge";
import { Button, Skeleton } from "@/components/ui";
import { AFTERSALE_STATUS_LABELS } from "@/lib/constants";
import type { AftersaleDTO, Page } from "@/lib/types";

const STATUS_OPTIONS = ["pending", "processing", "closed"] as const;

export default function AdminAftersalesPage() {
  const router = useRouter();
  const [status, setStatus] = useState("");
  const [phone, setPhone] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<Page<AftersaleDTO> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [draftStatus, setDraftStatus] = useState("");
  const [draftRemark, setDraftRemark] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    const qs = new URLSearchParams({ page: String(page), size: "20" });
    if (status) qs.set("status", status);
    if (phone) qs.set("phone", phone);
    try {
      const res = await fetch(`/api/admin/aftersales?${qs}`);
      const body = await res.json();
      if (res.status === 401 || body.code === 40100) {
        router.replace("/admin/login?redirect=/admin/aftersales");
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
  }, [page, status, phone, router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save(id: string) {
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/aftersales/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: draftStatus, remark: draftRemark }),
      });
      const body = await res.json();
      if (res.status === 401 || body.code === 40100) {
        router.replace("/admin/login?redirect=/admin/aftersales");
        return;
      }
      if (body.code !== 0) {
        setError(body.message ?? "保存失败");
        return;
      }
      setEditing(null);
      await load();
    } catch {
      setError("网络异常，请重试");
    } finally {
      setSaving(false);
    }
  }

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
              {AFTERSALE_STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        <input
          value={phone}
          onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 11))}
          placeholder="手机号搜索"
          inputMode="tel"
          className="h-9 w-[140px] rounded-[var(--radius-input)] bg-white px-2 text-[13px] outline-none ring-1 ring-[var(--color-separator)] tablet:w-[180px]"
        />
        <button type="button" onClick={() => { setPage(1); void load(); }} className="h-9 rounded-[var(--radius-input)] bg-white px-3 text-[13px] ring-1 ring-[var(--color-separator)]">
          刷新
        </button>
        <a href="/api/admin/export?type=aftersales" className="ml-auto flex h-9 items-center rounded-[var(--radius-input)] bg-[var(--color-primary)] px-3 text-[13px] font-medium text-white">
          导出 CSV
        </a>
      </div>

      {error ? <p className="px-4 pb-2 text-[13px] text-[var(--color-danger)] tablet:px-6">⚠ {error}</p> : null}

      {loading && !data ? (
        <div className="space-y-2 px-4 tablet:px-6">
          <Skeleton variant="rect" className="h-[72px]" />
          <Skeleton variant="rect" className="h-[72px]" />
        </div>
      ) : null}

      {data && data.items.length === 0 ? <p className="px-4 py-8 text-center text-[13px] text-[var(--color-label-2)] tablet:px-6">暂无售后报修</p> : null}

      <ul className="divide-y divide-[var(--color-separator)] bg-white">
        {data?.items.map((item) => (
          <li key={item.id} className="px-4 py-3 tablet:px-6">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-mono text-[13px] font-semibold">{item.id}</span>
              <StatusBadge status={item.status} kind="aftersale" />
              {item.inWarranty ? <span className="text-[12px] font-semibold text-[var(--color-success)]">保修期内</span> : null}
              <span className="text-[13px]">{item.phone}</span>
              {item.orderId ? <span className="text-[12px] text-[var(--color-label-2)]">关联 {item.orderId}</span> : <span className="text-[12px] text-[var(--color-label-2)]">未匹配订单</span>}
              <span className="ml-auto text-[12px] text-[var(--color-label-2)]">
                {new Date(item.createdAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })}
              </span>
            </div>
            <p className="mt-1 text-[13px] text-[var(--color-label-2)]">{item.description}</p>
            {(item.media ?? []).length > 0 ? (
              <div className="mt-2 flex gap-2">
                {(item.media ?? []).map((url) => (
                  <a key={url} href={url} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="客户上传照片" className="h-16 w-16 rounded-[var(--radius-thumb)] object-cover" />
                  </a>
                ))}
              </div>
            ) : null}
            {item.remark ? <p className="mt-1 text-[13px]">备注：{item.remark}</p> : null}

            {editing === item.id ? (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <select
                  value={draftStatus}
                  onChange={(e) => setDraftStatus(e.target.value)}
                  className="h-9 rounded-[var(--radius-input)] bg-[var(--color-fill)] px-2 text-[13px] outline-none"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {AFTERSALE_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
                <input
                  value={draftRemark}
                  onChange={(e) => setDraftRemark(e.target.value)}
                  placeholder="处理备注"
                  className="h-9 min-w-[160px] flex-1 rounded-[var(--radius-input)] bg-[var(--color-fill)] px-2 text-[13px] outline-none"
                />
                <Button variant="primary" loading={saving} loadingText="保存中…" onClick={() => void save(item.id)}>
                  保存
                </Button>
                <Button variant="text" onClick={() => setEditing(null)}>
                  取消
                </Button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setEditing(item.id);
                  setDraftStatus(item.status);
                  setDraftRemark(item.remark ?? "");
                }}
                className="mt-2 h-8 rounded-md bg-[var(--color-fill)] px-3 text-[13px]"
              >
                处理
              </button>
            )}
          </li>
        ))}
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
