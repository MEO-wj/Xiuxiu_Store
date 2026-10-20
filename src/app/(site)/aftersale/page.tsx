/**
 * 售后报修页 `/aftersale`（UIUX §7.10 / PRD REQ-10）：
 * - 顶部保修提示条（WARRANTY_NOTICE，constants 唯一口径）
 * - 手机号输入完成（失焦 / 11 位输满）→ GET /api/aftersales/lookup
 *   查询中：订单卡位置骨架屏（1.2s 扫光），不显示空态
 *   匹配到：订单卡 + 「是这单 / 不是这单」；未匹配：Info 提示（不阻止提交）
 * - 问题描述（必填）+ 照片 ≤3 + 二维码 + 提交（底部操作栏）
 */
"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

import {
  Button,
  FieldBlock,
  Notice,
  QrCard,
  Skeleton,
  SkeletonText,
  Toast,
} from "@/components/ui";
import { NavBar } from "@/components/site/NavBar";
import { PhotoUploader } from "@/components/site/PhotoUploader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteKeyframes } from "@/components/site/keyframes";
import { CheckIcon, CloseIcon } from "@/components/site/icons";
import {
  CLEAN_TIER_SHORT_LABELS,
  MAX_PHOTOS,
  SERVICE_TYPE_LABELS,
  SHOP_NAME,
  SHOP_PHONE,
  WARRANTY_NOTICE,
} from "@/lib/constants";
import type { CreateAftersaleResult, LookupResult } from "@/lib/types";

type LookupState = "idle" | "loading" | "found" | "notfound" | "error";

export default function AftersalePage() {
  const router = useRouter();

  const [phone, setPhone] = useState("");
  const [description, setDescription] = useState("");
  const [media, setMedia] = useState<string[]>([]);

  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [lookupState, setLookupState] = useState<LookupState>("idle");
  /** 「不是这单」确认态：隐藏订单卡，展示未匹配提示 */
  const [rejected, setRejected] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const lastLookupPhone = useRef("");
  const formRef = useRef<HTMLFormElement>(null);
  const focusError = () => window.requestAnimationFrame(() => {
    const field = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    field?.focus();
    field?.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth" });
  });



  /** 手机号输入完成（11 位输满 / 失焦）自动查询（PRD C2） */
  const runLookup = (value: string) => {
    const p = value.trim();
    if (!/^1[3-9]\d{9}$/.test(p)) return;
    if (p === lastLookupPhone.current) return;
    lastLookupPhone.current = p;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;
    setLookupState("loading");
    setRejected(false);
    fetch(`/api/aftersales/lookup?phone=${encodeURIComponent(p)}`, { signal: controller.signal })
      .then((res) => res.json().catch(() => null))
      .then((json: { code: number; data: LookupResult | null } | null) => {
        if (controller.signal.aborted) return;
        if (json && json.code === 0 && json.data) {
          setLookup(json.data);
          setLookupState(json.data.found ? "found" : "notfound");
        } else {
          lastLookupPhone.current = "";
          setLookupState("error");
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) { setLookupState("error"); lastLookupPhone.current = ""; }
      });
  };

  /** 首次输满 11 位自动触发 */
  const onPhoneChange = (value: string) => {
    const cleaned = value.replace(/[^\d]/g, "").slice(0, 11);
    abortRef.current?.abort();
    lastLookupPhone.current = "";
    setLookup(null);
    setLookupState("idle");
    setRejected(false);
    setPhone(cleaned);
    if (cleaned.length === 11) runLookup(cleaned);
  };

  useEffect(() => () => abortRef.current?.abort(), []);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (formRef.current?.querySelector('[aria-busy="true"]')) { setToast("照片正在上传，完成后再提交报修"); return; }
    const errs: Record<string, string> = {};
    if (!/^1[3-9]\d{9}$/.test(phone.trim())) errs["phone"] = "请填写正确的 11 位手机号";
    if (description.trim().length === 0) errs["description"] = "请描述一下具体问题";
    if (description.length > 300) errs["description"] = "描述不能超过 300 字";
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      setToast("请检查填写内容");
      focusError();
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/aftersales", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phone: phone.trim(),
          description: description.trim(),
          media: media.length > 0 ? media : null,
        }),
      });
      const json = (await res.json().catch(() => null)) as
        | { code: number; message: string; data: CreateAftersaleResult | { fields?: { field: string; message: string }[] } | null }
        | null;
      if (!json) throw new Error("提交失败");
      if (json.code !== 0 || !json.data || !("aftersaleId" in json.data)) {
        const fields = (json.data as { fields?: { field: string; message: string }[] } | null)?.fields;
        if (fields && fields.length > 0) {
          setErrors(Object.fromEntries(fields.map((f) => [f.field, f.message])));
          focusError();
        }
        setToast(json.message);
        return;
      }
      const params = new URLSearchParams({
        aftersaleId: json.data.aftersaleId,
        etaText: json.data.etaText,
      });
      router.push(`/aftersale/success?${params.toString()}`);
    } catch {
      setToast("提交失败，请重试或直接拨打 " + SHOP_PHONE);
    } finally {
      setSubmitting(false);
    }
  };

  const matched = lookup && lookup.found === true ? lookup : null;

  return (
    <main className="min-h-[100dvh] bg-bg pb-bottom-bar tablet:pb-12">
      <SiteKeyframes />
      <NavBar title="售后报修" backHref="/" backLabel="返回主页" />

      <form ref={formRef} onSubmit={onSubmit} noValidate className="mx-auto w-full max-w-[40rem] px-4 pt-[calc(env(safe-area-inset-top,0px)+4rem)] tablet:px-6">
        {/* 顶部保修提示条（PRD §5.3 固定说明，§7.10） */}
        <Notice variant="info" className="mt-4">
          {WARRANTY_NOTICE}
        </Notice>

        {/* ── 手机号 ── */}
        <section className="mt-5 overflow-hidden rounded-card bg-surface">
          <div className="px-4">
            <div className="flex min-h-[3.25rem] items-center gap-3 py-1">
              <label htmlFor="aftersale-phone" className="shrink-0 text-[1.0625rem] text-label">
                手机号
              </label>
              <div className="flex min-w-0 flex-1 items-center justify-end">
                <input
                  id="aftersale-phone"
                  type="tel"
                  inputMode="tel"
                  autoComplete="tel"
                  maxLength={11}
                  placeholder="维修时预留的 11 位手机号"
                  value={phone}
                  onChange={(e) => onPhoneChange(e.target.value)}
                  onBlur={() => runLookup(phone)}
                  aria-invalid={errors["phone"] ? true : undefined}
                  aria-describedby={errors["phone"] ? "aftersale-phone-error" : "aftersale-phone-hint"}
                  className="min-w-0 flex-1 bg-transparent text-right text-[1.0625rem] text-label focus-visible:outline-none"
                />
              </div>
            </div>
            <p
              id={errors["phone"] ? "aftersale-phone-error" : "aftersale-phone-hint"}
              aria-live="polite"
              className="flex min-h-[1.125rem] items-start gap-1 pt-1 text-footnote"
            >
              {errors["phone"] ? (
                <span className="text-danger">⚠ {errors["phone"]}</span>
              ) : (
                <span className="text-label-2">仅支持手机号，不接受座机</span>
              )}
            </p>
          </div>
        </section>

        {/* ── 订单匹配（三态：查询中骨架 / 匹配卡 / 未匹配提示，§7.10） ── */}
        {lookupState === "loading" && (
          <section className="mt-4 rounded-card bg-surface p-4" aria-label="正在查询订单">
            <SkeletonText lines={2} />
            <div className="mt-3 h-8">
              <Skeleton variant="rect" className="h-8 rounded-pill" />
            </div>
          </section>
        )}

        {lookupState === "found" && matched && !rejected && (
          <section className="xx-fade-in mt-4 rounded-card bg-surface p-4">
            <p className="text-[0.9375rem] font-semibold text-label">已找到您的订单：</p>
            <div className="mt-1.5 flex flex-wrap items-baseline gap-x-2 gap-y-1">
              <span className="text-headline font-semibold text-label">
                {matched.serviceType === "clean" && matched.cleanTier
                  ? `${SERVICE_TYPE_LABELS.clean} ${CLEAN_TIER_SHORT_LABELS[matched.cleanTier]}`
                  : SERVICE_TYPE_LABELS[matched.serviceType]}
              </span>
              <span className="text-footnote tabular-nums text-label-2">{matched.orderDate}</span>
              {matched.inWarranty ? (
                <span className="inline-flex items-center gap-1 rounded-pill bg-success/[.10] px-2 py-0.5 text-caption font-semibold text-success">
                  <CheckIcon className="size-3.5" strokeWidth={2.6} />
                  保修期内（至 {matched.warrantyEndDate}）
                </span>
              ) : (
                <span className="rounded-pill bg-warning/[.12] px-2 py-0.5 text-caption font-medium text-[var(--color-warning-ink)]">
                  已过保修期
                </span>
              )}
            </div>
            <p className="mt-1 break-all text-footnote tabular-nums text-label-2">{matched.orderId}</p>
            {/* 是这单 / 不是这单（§7.10） */}
            <div className="mt-3 flex items-center gap-3">
              <Button variant="tinted" onClick={() => setRejected(false)} aria-pressed={!rejected}>
                <span className="inline-flex items-center gap-1.5">
                  <CheckIcon className="size-4" />
                  是这单
                </span>
              </Button>
              <Button variant="text" onClick={() => setRejected(true)} aria-pressed={rejected}>
                <span className="inline-flex items-center gap-1.5">
                  <CloseIcon className="size-4" />
                  不是这单
                </span>
              </Button>
            </div>
          </section>
        )}

        {((lookupState === "found" && rejected) || lookupState === "notfound") && (
          <Notice variant="info" className="xx-fade-in mt-4">
            未查询到订单，我们会与您核对
          </Notice>
        )}

        {lookupState === "error" && (
          <Notice variant="error" className="xx-fade-in mt-4">
            订单查询失败，不影响提交；我们会在联系您时核对信息
          </Notice>
        )}

        {/* ── 问题描述（必填） ── */}
        <section className="mt-4 overflow-hidden rounded-card bg-surface">
          <FieldBlock
            label="问题描述（必填）"
            rows={4}
            maxLength={300}
            value={description}
            onValueChange={setDescription}
            placeholder="例如：清灰后风扇声音反而变大了 / 开机温度还是很高 / 电脑开不了机…"
            error={errors["description"]}
          />
          <PhotoUploader
            label="问题照片"
            value={media}
            onChange={setMedia}
            hint={`选填，最多 ${MAX_PHOTOS} 张，单张 ≤5MB`}
          />
        </section>

        {/* ── 二维码（也可加微信，§7.10） ── */}
        <section className="mt-4 rounded-card bg-surface p-4">
          <QrCard size={128} title="扫码加 xiu xiu 官方微信" description="微信里聊也行" />
        </section>

        {/* 底部信息区（REQ-11） */}
        <SiteFooter />

        <div className="booking-submit">
          <div className="booking-bottom glass-bar fixed inset-x-0 bottom-0 z-(--z-footer) border-t border-separator px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))] tablet:static tablet:border-0 tablet:bg-transparent tablet:p-0 tablet:backdrop-blur-none">
            <div className="mx-auto max-w-[40rem]"><Button type="submit" block loading={submitting} loadingText="正在提交…">提交售后报修</Button></div>
          </div>
          <p>信息仅用于售后联系。提交后请留意电话，也可以通过页底官方微信联系我们。</p>
        </div>

      </form>

      <Toast open={toast !== null} message={toast ?? ""} onClose={() => setToast(null)} />


    </main>
  );
}
void Skeleton;
