/**
 * 全局底部信息区（UIUX §7.3 / PRD REQ-11）：
 * 店名 + 业务说明 / 官方微信二维码（96px 小图）/ 电话（可拨打）/ 营业时间 /
 * 售后报修入口 / 隐私说明。
 * ≥768px：二维码与文字并排，整体更宽松（docs/plan/桌面端适配与两步下单_v1.0.md §6.6）。
 * 电话与营业时间取自 constants（唯一口径，不得硬编码）。
 */
import Link from "next/link";

import { QrCard } from "@/components/ui";
import { BUSINESS_HOURS_END, BUSINESS_HOURS_START, SHOP_NAME, SHOP_PHONE } from "@/lib/constants";

export function SiteFooter() {
  return (
    <footer className="mx-auto w-full max-w-[75rem] px-4 pb-[calc(env(safe-area-inset-bottom,0px)+var(--space-8))] pt-8 tablet:px-6 tablet:pt-10">
      <div className="tablet:flex tablet:items-start tablet:gap-8">
        {/* 官方微信二维码（96px，与文字并排，弱化，§6.7） */}
        <div className="rounded-card bg-surface px-4 py-4 tablet:shrink-0">
          <QrCard
            size={96}
            title="扫码加 xiu xiu 官方微信"
            description="微信里聊也行"
            hint="长按识别二维码"
          />
        </div>

        <div className="mt-5 space-y-1.5 text-footnote text-label-2 tablet:mt-0 tablet:max-w-[28rem]">
        <p className="font-semibold text-label">
          {SHOP_NAME} · 电脑清灰 / 换硅脂 / 系统维护
        </p>
        <p>
          电话{" "}
          {/* 热区 ≥44px（PRD §5.5）：行内链接用 padding + inline-flex 补足 */}
          <a
            href={`tel:${SHOP_PHONE}`}
            className="inline-flex min-h-[44px] items-center font-semibold text-primary underline-offset-4 hover:underline active:opacity-70"
          >
            {SHOP_PHONE}
          </a>
        </p>
        <p>
          营业时间：每日 {BUSINESS_HOURS_START}:00–{BUSINESS_HOURS_END}:00
        </p>
        <p>
          <Link
            href="/aftersale"
            className="inline-flex min-h-[44px] items-center font-semibold text-primary underline-offset-4 hover:underline active:opacity-70"
          >
            售后报修
          </Link>
        </p>
        <p className="pt-1 text-caption text-label-3">
          您填写的信息仅用于本次维修服务联系
        </p>
        </div>
      </div>
    </footer>
  );
}
