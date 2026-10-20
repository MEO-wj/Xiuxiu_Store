/**
 * 售后提交成功页 `/aftersale/success`（UIUX §7.11 / PRD REQ-10）：
 * 对勾 + 「已提交报修」+ 售后单号 +「已收到，我们会尽快联系您核对」+ 240px 二维码。
 * 单号与时效文案从 URL 参数读取（提交后路由携带）。
 */
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

import { QrCard } from "@/components/ui";
import { NavBar } from "@/components/site/NavBar";
import { SiteKeyframes } from "@/components/site/keyframes";
import { ChevronLeftIcon } from "@/components/site/icons";
import { ETA_TEXT_AFTERSALE, SHOP_PHONE } from "@/lib/constants";

export default function AftersaleSuccessPage() {
  const [aftersaleId, setAftersaleId] = useState<string | null>(null);

  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("aftersaleId");
    if (id) setAftersaleId(id);
  }, []);

  return (
    <main className="flow-page min-h-[100dvh] bg-bg">
      <SiteKeyframes />
      <NavBar title="售后结果" backHref="/" backLabel="返回主页" />

      <div className="success-shell mx-auto w-full max-w-[40rem] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+var(--space-10))] pt-[calc(env(safe-area-inset-top,0px)+4.5rem)] tablet:px-6 tablet:pt-[calc(env(safe-area-inset-top,0px)+5.5rem)]">
        {/* 主色圆形对勾（§7.11） */}
        <div className="flex justify-center">
          {aftersaleId && <span className="xx-success-pop flex size-16 items-center justify-center rounded-full bg-primary text-white shadow-btn">
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

        <h1 className="mt-5 text-center text-title-1 text-label">{aftersaleId ? "报修已收到。" : "还没有报修信息"}</h1>

        {/* 售后单号：可长按复制（§7.11） */}
        <p
          className="mt-1.5 text-center text-headline tabular-nums text-label"
          aria-label={aftersaleId ? `售后单号 ${aftersaleId}，长按可复制` : "售后单号生成中"}
        >
          {aftersaleId ? `售后单号 ${aftersaleId}` : "返回售后页，告诉我们遇到的问题"}
        </p>

        {/* 时效文案（PRD §5.3：已收到，我们会尽快联系您核对） */}
        <p className="mx-auto mt-4 max-w-[280px] text-center text-body text-label-2">{aftersaleId ? ETA_TEXT_AFTERSALE : <Link href="/aftersale" className="text-primary">去填写售后报修 →</Link>}</p>

        {/* 240px 二维码白卡（§7.11） */}
        <div className="mt-8 rounded-card bg-surface px-4 py-6">
          <div className="flex justify-center">
            <QrCard size={184} hint={null} />
          </div>
          <p className="mt-5 text-center text-[0.9375rem] font-medium text-label">
            也可加官方微信 · 长按识别
          </p>
        </div>

        {/* 拨打 + 返回主页 */}
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
