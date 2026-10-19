"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { AdminNav } from "@/components/admin/AdminNav";
import { ServiceTags, StatusBadge } from "@/components/admin/StatusBadge";
import { Button, Notice, Skeleton } from "@/components/ui";
import { CLEAN_TIER_LABELS, CONTACT_PREF_LABELS, ORDER_STATUS_LABELS, OTHER_TYPE_LABELS, SERVICE_MODE_LABELS, SERVICE_TYPE_LABELS } from "@/lib/constants";
import type { AftersaleDTO, OrderDTO } from "@/lib/types";

type Detail = OrderDTO & { aftersales: AftersaleDTO[] };

const STATUS_OPTIONS = ["pending", "processing", "done", "aftersale", "closed"] as const;

export default function AdminOrderDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params.id;

  const [detail, setDetail] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [status, setStatus] = useState("");
  const [remark, setRemark] = useState("");
  const [finalPrice, setFinalPrice] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${id}`);
      const body = await res.json();
      if (res.status === 401 || body.code === 40100) {
        router.replace(`/admin/login?redirect=/admin/orders/${id}`);
        return;
      }
      if (body.code !== 0) {
        setError(body.message ?? "加载失败");
        return;
      }
      const d = body.data as Detail;
      setDetail(d);
      setStatus(d.status);
      setRemark(d.remark ?? "");
      setFinalPrice(d.finalPrice ?? "");
    } catch {
      setError("网络异常，请重试");
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    void load();
  }, [load]);

  async function save() {
    setSaving(true);
    setMessage("");
    setError("");
    try {
      const payload: Record<string, unknown> = {};
      if (detail && status !== detail.status) payload.status = status;
      if (remark !== (detail?.remark ?? "")) payload.remark = remark;
      if (finalPrice !== (detail?.finalPrice ?? "")) payload.finalPrice = finalPrice === "" ? null : finalPrice;

      if (Object.keys(payload).length === 0) {
        setMessage("没有需要保存的修改");
        return;
      }

      const res = await fetch(`/api/admin/orders/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await res.json();
      if (body.code !== 0) {
        setError(body.message ?? "保存失败");
        return;
      }
      setDetail(body.data as Detail);
      setStatus(body.data.status);
      setRemark(body.data.remark ?? "");
      setFinalPrice(body.data.finalPrice ?? "");
      setMessage("已保存");
    } catch {
      setError("网络异常，请重试");
    } finally {
      setSaving(false);
    }
  }

  const statusNeedsRemark = ["done", "processing", "pending", "closed"].includes(status) && detail?.status !== status;

  return (
    <div className="pb-16 desktop:mx-auto desktop:max-w-[64rem]">
      <AdminNav />
      <div className="px-4 py-3 tablet:px-6">
        <Link href="/admin/orders" className="text-[13px] text-[var(--color-primary)]">
          ‹ 返回列表
        </Link>
      </div>

      {loading && !detail ? (
        <div className="space-y-2 px-4 tablet:px-6">
          <Skeleton variant="rect" className="h-[120px]" />
          <Skeleton variant="rect" className="h-40" />
        </div>
      ) : null}

      {error ? (
        <div className="px-4 pb-3 tablet:px-6">
          <Notice variant="error">{error}</Notice>
        </div>
      ) : null}
      {message ? (
        <div className="px-4 pb-3 tablet:px-6">
          <Notice variant="success">{message}</Notice>
        </div>
      ) : null}

      {detail ? (
        <div className="space-y-3 desktop:grid desktop:grid-cols-[minmax(0,1fr)_20rem] desktop:items-start desktop:gap-6 desktop:space-y-0">
          <section className="bg-white p-4 tablet:p-6">
            <div className="mb-3 flex items-center gap-2">
              <span className="font-mono text-[15px] font-semibold">{detail.id}</span>
              <StatusBadge status={detail.status} />
              {detail.notifyStatus === "failed" ? <span className="text-[12px] font-semibold text-[var(--color-danger)]">通知失败</span> : null}
              <span className="ml-auto">
                <ServiceTags serviceMode={detail.serviceMode} contactPref={detail.contactPref} />
              </span>
            </div>
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 sm:grid-cols-2">
              <Row label="服务类型" value={detail.serviceType === "clean" ? `${SERVICE_TYPE_LABELS.clean} · ${CLEAN_TIER_LABELS[detail.cleanTier ?? "basic80"]}` : SERVICE_TYPE_LABELS.other} />
              <Row label="问题类型" value={(detail.otherTypes ?? []).map((t) => OTHER_TYPE_LABELS[t]).join(" / ") || "—"} />
              <Row label="联系人" value={detail.contactName} />
              <Row label="电话" value={detail.phone} />
              <Row label="品牌 / 型号" value={detail.brandModel} />
              <Row label="联系偏好" value={CONTACT_PREF_LABELS[detail.contactPref]} />
              <Row label="服务方式" value={SERVICE_MODE_LABELS[detail.serviceMode]} />
              <Row label="期望时间" value={detail.preferredTime ?? "尽快"} />
              <Row label="地址" value={detail.address ?? "—"} />
              <Row label="下单时间" value={new Date(detail.createdAt).toLocaleString("zh-CN", { timeZone: "Asia/Shanghai", hour12: false })} />
              <Row label="最终价格" value={detail.finalPrice ?? "—"} />
            </dl>
            {detail.description ? <p className="mt-3 text-[13px] text-[var(--color-label-2)]">故障描述：{detail.description}</p> : null}
            {(detail.modelPhotos ?? []).length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {(detail.modelPhotos ?? []).map((url) => (
                  <a key={url} href={url} target="_blank" rel="noreferrer">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="客户上传照片" className="h-20 w-20 rounded-[var(--radius-thumb)] object-cover" />
                  </a>
                ))}
              </div>
            ) : null}
          </section>

          <section className="bg-white p-4 tablet:p-6 desktop:sticky desktop:top-16">
            <h2 className="mb-2 text-[14px] font-semibold">处理</h2>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="text-[13px] text-[var(--color-label-2)]">
                状态
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="mt-1 h-10 w-full rounded-[var(--radius-input)] bg-[var(--color-fill)] px-2 text-[14px] text-[var(--color-label)] outline-none"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {ORDER_STATUS_LABELS[s]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-[13px] text-[var(--color-label-2)]">
                最终价格
                <input
                  value={finalPrice}
                  onChange={(e) => setFinalPrice(e.target.value.replace(/[^\d.]/g, ""))}
                  placeholder="如 100.00"
                  inputMode="decimal"
                  className="mt-1 h-10 w-full rounded-[var(--radius-input)] bg-[var(--color-fill)] px-2 text-[14px] text-[var(--color-label)] outline-none"
                />
              </label>
            </div>
            <label className="mt-3 block text-[13px] text-[var(--color-label-2)]">
              备注（回退或跨状态流转必须填写）
              <textarea
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                rows={3}
                className="mt-1 w-full rounded-[var(--radius-input)] bg-[var(--color-fill)] p-2 text-[14px] text-[var(--color-label)] outline-none"
              />
            </label>
            {statusNeedsRemark && !remark.trim() ? (
              <p className="mt-2 text-[13px] text-[var(--color-warning)]">⚠ 该状态流转需要填写备注，否则将被拒绝（40006）</p>
            ) : null}
            <div className="mt-3">
              <Button variant="primary" loading={saving} loadingText="保存中…" onClick={save}>
                保存
              </Button>
            </div>
          </section>

          <section className="bg-white p-4 tablet:p-6">
            <h2 className="mb-2 text-[14px] font-semibold">关联售后（{detail.aftersales.length}）</h2>
            {detail.aftersales.length === 0 ? (
              <p className="text-[13px] text-[var(--color-label-2)]">暂无</p>
            ) : (
              <ul className="divide-y divide-[var(--color-separator)]">
                {detail.aftersales.map((a) => (
                  <li key={a.id} className="flex flex-wrap items-center gap-2 py-2 text-[13px]">
                    <span className="font-mono">{a.id}</span>
                    <StatusBadge status={a.status} kind="aftersale" />
                    {a.inWarranty ? <span className="text-[var(--color-success)]">保修期内</span> : null}
                    <span className="text-[var(--color-label-2)]">{a.description}</span>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      ) : null}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex gap-2 text-[13px]">
      <dt className="w-20 shrink-0 text-[var(--color-label-2)]">{label}</dt>
      <dd className="min-w-0 break-all">{value}</dd>
    </div>
  );
}
