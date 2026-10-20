/**
 * 提交成功页 `/success`（UIUX §7.9 / PRD REQ-09）：
 * - 单号（Headline，可长按复制：user-select 保持开启）+ 时效文案
 * - 读 ?orderId= 后用 GET /api/orders/{id} 刷新校验；接口不可用时降级展示 URL 携带的 summary
 * - 240px 二维码白卡（页面次焦点）+「也可以先加微信，把电脑的情况发给我们」
 * - 拨打按钮（tel:）+ 返回主页（导航栏）
 */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { QrCard, Skeleton } from "@/components/ui";
import { NavBar } from "@/components/site/NavBar";
import { SiteKeyframes } from "@/components/site/keyframes";
import { ChevronLeftIcon } from "@/components/site/icons";
import {
  CLEAN_TIER_SHORT_LABELS,
  SERVICE_TYPE_LABELS,
  SHOP_PHONE,
} from "@/lib/constants";
import type { CleanTier, ServiceType } from "@/lib/constants";
import type { OrderPublicSummary } from "@/lib/types";

/** URL 携带的降级摘要（提交后路由跳转时带上；接口不可用时兜底展示） */
type UrlSummary = {
  orderId: string;
  etaText: string;
  serviceType: ServiceType;
  cleanTier: CleanTier | null;
};

function parseUrlSummary(search: string): UrlSummary | null {
  const params = new URLSearchParams(search);
  const orderId = params.get("orderId");
  if (!orderId) return null;
  const serviceType = params.get("serviceType");
  const cleanTier = params.get("cleanTier");
  return {
    orderId,
    etaText: params.get("etaText") ?? "",
    serviceType: serviceType === "other" ? "other" : "clean",
    cleanTier: cleanTier === "deep100" ? "deep100" : cleanTier === "basic80" ? "basic80" : null,
  };
}

/** 服务类型展示文案 */
function serviceLabel(s: { serviceType: ServiceType; cleanTier: CleanTier | null }): string {
  if (s.serviceType === "clean" && s.cleanTier) {
    return `${SERVICE_TYPE_LABELS.clean} · ${CLEAN_TIER_SHORT_LABELS[s.cleanTier]}`;
  }
  return SERVICE_TYPE_LABELS[s.serviceType];
}

export default function SuccessPage() {
  const [summary, setSummary] = useState<OrderPublicSummary | null>(null);
  const [fallback, setFallback] = useState<UrlSummary | null>(null);
  const [state, setState] = useState<"loading" | "ok" | "fallback">("loading");

  useEffect(() => {
    const fb = parseUrlSummary(window.location.search);
    setFallback(fb);
    const orderId = fb?.orderId ?? new URLSearchParams(window.location.search).get("orderId");
    if (!orderId) {
      setState("fallback");
      return;
    }
    let cancelled = false;
    // GET /api/orders/{id} 刷新校验（§3.4）；失败降级为 URL summary（不得白屏）
    fetch(`/api/orders/${encodeURIComponent(orderId)}`)
      .then((res) => res.json().catch(() => null))
      .then((json: { code: number; data: OrderPublicSummary | null } | null) => {
        if (cancelled) return;
        if (json && json.code === 0 && json.data) {
          setSummary(json.data);
          setState("ok");
        } else {
          setState("fallback");
        }
      })
      .catch(() => {
        if (!cancelled) setState("fallback");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const orderId = summary?.orderId ?? fallback?.orderId ?? "—";
  const etaText = summary?.etaText ?? fallback?.etaText ?? "";
  const svc = summary ?? fallback;
  const hasData = svc !== null;

  return (
    <main className="flow-page min-h-[100dvh] bg-bg">
      <SiteKeyframes />
      <NavBar title="预约结果" backHref="/" backLabel="返回首页" />

      <div className="success-shell mx-auto w-full max-w-[40rem] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+var(--space-10))] pt-[calc(env(safe-area-inset-top,0px)+4.5rem)] tablet:px-6 tablet:pt-[calc(env(safe-area-inset-top,0px)+5.5rem)]">
        {/* 主色圆形对勾 64px（描边动画 ≤600ms 一次性，§7.9） */}
        <div className="flex justify-center">
          {hasData && <span className="xx-success-pop flex size-16 items-center justify-center rounded-full bg-primary text-white shadow-btn">
            <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-8">
              <path
                d="m5 12.5 4.5 4.5L19 7.5"
                stroke="currentColor"
                strokeWidth="2.4"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>}
        </div>

        <h1 className="mt-5 text-center text-title-1 text-label">{state === "loading" ? "正在确认预约…" : hasData ? "预约已收到。" : "还没有预约信息"}</h1>

        {/* 单号：Headline，可长按复制（user-select 保持开启，§9.1） */}
        <p
          className="mt-1.5 text-center text-headline tabular-nums text-label"
          aria-label={`订单号 ${orderId}，长按可复制`}
        >
          {hasData ? `预约单号 ${orderId}` : "可以返回首页选择需要的服务"}
        </p>

        {/* 时效文案：Body 居中最大宽 280px（§7.9） */}
        <div className="mx-auto mt-4 min-h-[3rem] max-w-[280px] text-center">
          {state === "loading" && !hasData ? (
            <div className="flex flex-col items-center gap-2" aria-label="加载中">
              <Skeleton width="full" />
              <Skeleton width="2/3" />
            </div>
          ) : (
            etaText && <p className="text-body text-label-2">{etaText}</p>
          )}
          {state !== "loading" && svc && (
            <p className="mt-1.5 text-footnote text-label-3">{serviceLabel(svc)}</p>
          )}
          {state === "fallback" && !hasData && (
            <Link href="/order" className="action-primary">去预约维修 ↗</Link>
          )}
        </div>

        {hasData && <div className="confirmation-next"><span>01</span><div><strong>接下来，等我们联系你。</strong><p>我们会确认电脑情况、维修方案与服务时间。报价经你确认后再维修，无需在线付款。</p></div></div>}

        {/* 240px 二维码白卡（页面次焦点，上下留白 ≥24px，§6.7 / §7.9） */}
        <div className="mt-8 rounded-card bg-surface px-4 py-6">
          <div className="flex justify-center">
            <QrCard size={184} hint={null} />
          </div>
          <p className="mt-5 text-center text-[0.9375rem] font-medium text-label">
            也可以先加微信，把电脑的情况发给我们
          </p>
          <p className="mt-1 text-center text-caption text-label-2">长按识别二维码</p>
        </div>

        {/* 拨打按钮（Secondary，§7.9） */}
        <div className="mt-6 space-y-3">
          <a
            href={`tel:${SHOP_PHONE}`}
            className="flex h-11 w-full items-center justify-center rounded-card border border-primary bg-surface text-[1.0625rem] font-semibold text-primary transition-transform duration-(--dur-instant) active:scale-[.97]"
          >
            拨打 {SHOP_PHONE}
          </a>
          <Link
            href="/"
            className="flex h-11 w-full items-center justify-center gap-1 rounded-card text-[1.0625rem] font-semibold text-primary transition-transform duration-(--dur-instant) active:scale-[.97]"
          >
            <ChevronLeftIcon className="size-5" />
            返回主页
          </Link>
        </div>
      </div>
    </main>
  );
}
