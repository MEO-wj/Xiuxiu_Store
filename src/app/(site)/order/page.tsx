/** Two-step customer booking: service selection, then contact and scheduling.
 * One responsive form action; desktop summary is read-only.
 */
"use client";

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";

import {
  Button,
  Chip,
  FieldBlock,
  FieldRow,
  Notice,
  QrCard,
  Segmented,
  Toast,
} from "@/components/ui";
import { ServiceIcon } from "@/components/site/ServiceIcon";
import { NavBar } from "@/components/site/NavBar";
import { PhotoUploader } from "@/components/site/PhotoUploader";
import { PreferredTimeSheet } from "@/components/site/PreferredTimeSheet";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteKeyframes } from "@/components/site/keyframes";
import { ChevronDownIcon } from "@/components/site/icons";
import {
  CLEAN_TIER_DESCRIPTIONS,
  CLEAN_TIER_SHORT_LABELS,
  CONTACT_PREF_LABELS,
  HOME_SERVICE_NOTICE,
  MAX_PHOTOS,
  OTHER_PRICE_NOTICE,
  OTHER_TYPE_LABELS,
  PRICE_BASIC,
  PRICE_DEEP,
  SERVICE_MODE_LABELS,
  SERVICE_TYPE_LABELS,
  SHOP_PHONE,
} from "@/lib/constants";
import { preferredTimeLabel } from "@/lib/format";
import type { CleanTier, ContactPref, OtherType, ServiceMode, ServiceType } from "@/lib/constants";
import type { CreateOrderResult } from "@/lib/types";

/** 步骤 1 需回到第 1 步展示的服务端字段（docs/plan/桌面端适配与两步下单_v1.0.md §4.4） */
const STEP1_FIELDS = new Set(["serviceType", "cleanTier", "otherTypes"]);

/* ─── 分组标题（Title2，左对齐，24px 上间距，UIUX §7.3） ─────────────────── */
function GroupTitle({ children, id }: { children: string; id?: string }) {
  return (
    <h2 id={id} className="group-title text-label">
      {children}
    </h2>
  );
}

/** 分组卡片容器（白底圆角 12，§6.2） */
function GroupCard({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <section className={clsx("group-card overflow-hidden rounded-card bg-surface", className)}>{children}</section>
  );
}

/** 卡片内分隔线：距左 16px（§6.2） */
function RowDivider() {
  return <div className="ml-4 border-t-[0.5px] border-separator" aria-hidden="true" />;
}

/* ─── 步骤条（约定 §4.2） ────────────────────────────────────────────────── */
function StepDot({ active, done, number }: { active: boolean; done: boolean; number: number }) {
  return (
    <span
      aria-hidden="true"
      className={clsx(
        "flex size-6 shrink-0 items-center justify-center rounded-full text-caption font-semibold",
        active
          ? "bg-primary text-white"
          : done
            ? "bg-primary-soft text-primary"
            : "bg-fill text-label-3",
      )}
    >
      {done ? "✓" : number}
    </span>
  );
}

function StepBar({ step, onBackToStep1 }: { step: 1 | 2; onBackToStep1: () => void }) {
  return (
    <ol className="booking-stepper" aria-label="预约步骤">
      <li aria-current={step === 1 ? "step" : undefined} className="flex items-center gap-2">
        <button
          type="button"
          onClick={onBackToStep1}
          disabled={step === 1}
          className={clsx(
            "flex items-center gap-2 rounded-pill py-1 pr-2 text-[0.9375rem] transition-colors duration-(--dur-fast)",
            step === 1
              ? "cursor-default font-semibold text-primary"
              : "font-medium text-label-2 hover:bg-fill",
          )}
        >
          <StepDot active={step === 1} done={step === 2} number={1} />
          选择服务
        </button>
      </li>
      <li aria-hidden="true" className="h-[1.5px] min-w-4 flex-1 rounded-pill bg-separator" />
      <li
        aria-current={step === 2 ? "step" : undefined}
        className={clsx(
          "flex items-center gap-2 py-1 pl-2 text-[0.9375rem]",
          step === 2 ? "font-semibold text-primary" : "font-medium text-label-3",
        )}
      >
        <StepDot active={step === 2} done={false} number={2} />
        填写信息
      </li>
    </ol>
  );
}

/* ─── 套餐卡片（UIUX §6.3） ──────────────────────────────────────────────── */
function TierCard({
  tier,
  label,
  price,
  description,
  recommended,
  selected,
  onSelect,
}: {
  tier: CleanTier;
  label: string;
  price: string;
  description: string;
  recommended?: boolean;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <label
      data-selected={selected}
      data-tier={tier}
      className={clsx(
        "tier-option relative block w-full cursor-pointer border text-left has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-primary has-[:focus-visible]:outline-offset-4",
        "transition-[background-color,border-color,transform] duration-(--dur-fast) ease-gentle active:scale-[.98]",
        selected
          ? "border-primary bg-primary-soft"
          : "border-separator bg-surface hover:bg-fill",
      )}
    >
      <input type="radio" name="clean-tier" checked={selected} onChange={onSelect} aria-label={`${label} ¥${Number(price)}`} className="sr-only" />
      {recommended && <span className="tier-recommend">适合长期未清理的电脑</span>}
      <span className="tier-heading">
        <span className={clsx("text-[1.0625rem] font-semibold", selected ? "text-primary" : "text-label")}>
          {label}
        </span>
        <span className="tier-price font-semibold tabular-nums text-label">¥{Number(price)}</span>
      </span>
      <span className="mt-2 block text-footnote leading-relaxed text-label-2">{description}</span>
        <span className="tier-check" aria-hidden="true">
          {selected && (
          <svg viewBox="0 0 24 24" fill="none" aria-hidden="true" className="size-4">
            <path d="m5 12.5 4.5 4.5L19 7.5" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
          </svg>)}
        </span>
    </label>
  );
}

/* ─── 页面组件 ───────────────────────────────────────────────────────────── */
export default function OrderPage() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  // 服务类型（REQ-05/06/07）
  const [svcType, setSvcType] = useState<ServiceType>("clean");
  const [tier, setTier] = useState<CleanTier>("basic80");
  const [types, setTypes] = useState<OtherType[]>([]);

  // 联系信息（A2–A6）
  const [contactName, setContactName] = useState("");
  const [phone, setPhone] = useState("");
  const [brandModel, setBrandModel] = useState("");
  const [modelPhotos, setModelPhotos] = useState<string[]>([]);
  const [description, setDescription] = useState("");

  // 联系偏好 / 服务方式 / 期望时间 / 地址（A7–A10）
  const [pref, setPref] = useState<ContactPref>("phone");
  const [mode, setMode] = useState<ServiceMode>("shop");
  const [preferredTime, setPreferredTime] = useState("尽快");
  const [address, setAddress] = useState("");
  const [sheetOpen, setSheetOpen] = useState(false);

  // 步骤（1 选择服务 / 2 填写信息）
  const [step, setStep] = useState<1 | 2>(1);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("service") === "other") setSvcType("other");
    if (params.get("tier") === "deep100") setTier("deep100");
  }, []);

  const focusFirstError = () => window.requestAnimationFrame(() => {
    const field = formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]');
    field?.focus();
    field?.scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "center" });
  });

  // 校验错误（字段级）与提交状态
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const isOther = svcType === "other";
  const otherIncludesOther = types.includes("other");

  /** 价格摘要（底部操作栏与桌面右栏同一口径，§6.10） */
  const priceSummary = useMemo(() => {
    if (isOther) return "联系报价";
    return tier === "deep100" ? `¥${PRICE_DEEP}` : `¥${PRICE_BASIC}`;
  }, [isOther, tier]);

  /** 服务摘要（只读文案，Step 2 / 桌面右栏共用） */
  const serviceSummary = useMemo(() => {
    if (isOther) {
      const picked = types.map((t) => OTHER_TYPE_LABELS[t]);
      return picked.length > 0 ? `其他问题 · ${picked.join(" / ")}` : "其他问题 · 尚未选择问题类型";
    }
    return `${SERVICE_TYPE_LABELS.clean} · ${CLEAN_TIER_SHORT_LABELS[tier]}`;
  }, [isOther, types, tier]);

  /** Step 1 → Step 2：先做 Step 1 校验（仅 otherTypes），通过才前进 */
  const goStep2 = () => {
    if (isOther && types.length < 1) {
      setErrors((prev) => ({ ...prev, otherTypes: "请至少选择一个问题类型" }));
      setToast("请检查填写内容");
      focusFirstError();
      return;
    }
    setErrors((prev) => {
      if (!prev["otherTypes"]) return prev;
      const next = { ...prev };
      delete next["otherTypes"];
      return next;
    });
    setStep(2);
    window.scrollTo({ top: 0, behavior: "instant" });
    window.requestAnimationFrame(() => document.getElementById("booking-title")?.focus({ preventScroll: true }));
  };

  /** Step 2 → Step 1：保留全部已填数据 */
  const backToStep1 = () => {
    setStep(1);
    window.scrollTo({ top: 0, behavior: "instant" });
    window.requestAnimationFrame(() => document.getElementById("booking-title")?.focus({ preventScroll: true }));
  };

  /** 前端即时校验（validation.ts 同口径文案；最终以后端 message 为准） */
  const validate = (): Record<string, string> => {
    const errs: Record<string, string> = {};
    if (isOther && types.length < 1) errs["otherTypes"] = "请至少选择一个问题类型";
    if (isOther && otherIncludesOther && description.trim().length === 0) {
      errs["description"] = "请描述一下具体问题";
    }
    if (contactName.trim().length === 0) errs["contactName"] = "请填写联系人姓名";
    if (!/^1[3-9]\d{9}$/.test(phone.trim())) errs["phone"] = "请填写正确的 11 位手机号";
    if (brandModel.trim().length === 0) errs["brandModel"] = "请填写电脑品牌 / 型号";
    if (description.length > 300) errs["description"] = "描述不能超过 300 字";
    return errs;
  };

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (submitting) return;
    if (formRef.current?.querySelector('[aria-busy="true"]')) { setToast("照片正在上传，完成后再提交预约"); return; }
    const errs = validate();
    setErrors(errs);
    if (Object.keys(errs).length > 0) {
      setToast("请检查填写内容");
      focusFirstError();
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          serviceType: svcType,
          cleanTier: isOther ? null : tier,
          otherTypes: isOther ? types : null,
          contactName: contactName.trim(),
          phone: phone.trim(),
          contactPref: pref,
          brandModel: brandModel.trim(),
          modelPhotos: modelPhotos.length > 0 ? modelPhotos : null,
          description: description.trim() ? description.trim() : null,
          serviceMode: mode,
          preferredTime,
          address: mode === "home" && address.trim() ? address.trim() : null,
        }),
      });
      const json = (await res.json().catch(() => null)) as
        | { code: number; message: string; data: CreateOrderResult | { field?: string; fields?: { field: string; message: string }[] } | null }
        | null;
      if (!json) throw new Error("提交失败，请重试或直接拨打 " + SHOP_PHONE);
      if (json.code !== 0 || !json.data || !("orderId" in json.data)) {
        // 字段级错误定位到字段；非字段级（40003/40004/50000）Toast + 保留已填内容（API 契约 §7）
        const fields = (json.data as { fields?: { field: string; message: string }[] } | null)?.fields;
        if (fields && fields.length > 0) {
          setErrors(Object.fromEntries(fields.map((f) => [f.field, f.message])));
          // 若错误落在 Step 1 字段，回退到 Step 1 让用户看到（约定 §4.4）
          if (fields.some((f) => STEP1_FIELDS.has(f.field))) {
            setStep(1);
            window.scrollTo({ top: 0, behavior: "auto" });
          }
          focusFirstError();
        }
        setToast(json.message);
        return;
      }
      // 成功 → /success?orderId=…&etaText=…&serviceType=…&cleanTier=…
      const d = json.data as CreateOrderResult;
      const params = new URLSearchParams({
        orderId: d.orderId,
        etaText: d.etaText,
        serviceType: svcType,
      });
      if (!isOther && tier) params.set("cleanTier", tier);
      router.push(`/success?${params.toString()}`);
    } catch {
      setToast("提交失败，请重试或直接拨打 " + SHOP_PHONE);
    } finally {
      setSubmitting(false);
    }
  };

  const priceLine = `${priceSummary}${isOther ? "" : " 起"}`;

  return (
    <main className="flow-page min-h-[100dvh] bg-bg pb-bottom-bar tablet:pb-0">
      <SiteKeyframes />
      <NavBar title="在线预约" backHref="/" backLabel="返回首页" />
      <div className="flow-heading">
        <p className="eyebrow">LET’S FIX IT / 维修预约</p>
        <h1 id="booking-title" tabIndex={-1}>{step === 1 ? "先选一项适合的服务。" : "留个信息，方便联系你。"}</h1>
        <p>{step === 1 ? "清灰养护，或是解决故障。选好服务，再填写联系信息。" : "提交后我们会与你确认方案和时间，无需在线付款。"}</p>
      </div>
      <div className="booking-layout mx-auto w-full max-w-[40rem] px-4 tablet:px-6 desktop:max-w-[75rem]">
        <div className="desktop:grid desktop:grid-cols-[minmax(0,35rem)_22.5rem] desktop:justify-center desktop:gap-10">
          {/* ── 主列：表单 ── */}
          <div className="min-w-0">
            <form ref={formRef} id="booking-form" onSubmit={step === 1 ? (event) => { event.preventDefault(); goStep2(); } : onSubmit} noValidate>

              <StepBar step={step} onBackToStep1={backToStep1} />

              {step === 1 ? (
                /* ══ Step 1：选择服务 ══ */
                <div className="xx-fade-in">
                  <p className="booking-intro">不确定怎么选？有发烫、风扇噪音可先选清灰；其他情况选择「其他问题」，我们帮你检查。</p>
                  <GroupCard className="p-4">
                    <Segmented
                      label="服务类型"
                      value={svcType}
                      onChange={(v) => setSvcType(v)}
                      options={[
                        { value: "clean", label: SERVICE_TYPE_LABELS.clean },
                        { value: "other", label: SERVICE_TYPE_LABELS.other },
                      ]}
                    />

                    {/* 联动区：高度过渡 200ms 展开/收起，不整页跳转（§7.4） */}
                    <div className="mt-4">
                      {svcType === "clean" ? (
                        /* 清灰换硅脂：两档套餐卡片（默认 ¥80，§6.3） */
                        <div className="xx-fade-in space-y-3" role="radiogroup" aria-label="清灰套餐">
                          <TierCard
                            tier="basic80"
                            label="清灰换硅脂"
                            price={PRICE_BASIC}
                            description={CLEAN_TIER_DESCRIPTIONS.basic80}
                            selected={tier === "basic80"}
                            onSelect={() => setTier("basic80")}
                          />
                          <TierCard
                            tier="deep100"
                            label="深度清洁"
                            price={PRICE_DEEP}
                            description={CLEAN_TIER_DESCRIPTIONS.deep100}
                            recommended
                            selected={tier === "deep100"}
                            onSelect={() => setTier("deep100")}
                          />
                        </div>
                      ) : (
                        /* 其他问题：问题类型多选 Chip + 价格说明（§7.4） */
                        <div className="xx-fade-in space-y-3">
                          <Notice variant="info">{OTHER_PRICE_NOTICE}</Notice>
                          <div tabIndex={-1} aria-invalid={Boolean(errors.otherTypes) || undefined}>
                            <p className="mb-2 text-[0.9375rem] text-label">问题类型（多选，至少 1 项）</p>
                            <div className="flex flex-wrap gap-2">
                              {(Object.keys(OTHER_TYPE_LABELS) as OtherType[]).map((t) => (
                                <Chip
                                  key={t}
                                  label={OTHER_TYPE_LABELS[t]}
                                  selected={types.includes(t)}
                                  onSelect={() =>
                                    setTypes((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
                                  }
                                />
                              ))}
                            </div>
                            <p className="mt-2 min-h-[1.125rem] text-footnote text-danger">
                              {errors["otherTypes"] ?? ""}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </GroupCard>


                </div>
              ) : (
                /* ══ Step 2：填写信息 ══ */
                <div className="xx-fade-in">
                  {/* 已选服务（只读）+ 返回上一步（约定 §4.3：Step 2 顶部） */}
                  <div className="service-selection mb-4 flex items-center justify-between gap-3 rounded-card bg-surface px-4 py-3">
                    <div className="min-w-0">
                      <p className="text-caption text-label-2">已选服务</p>
                      <p className="text-[0.8125rem] font-semibold leading-relaxed text-label">{serviceSummary}</p>
                    </div>
                    <Button variant="text" type="button" onClick={backToStep1} className="shrink-0">
                      ← 上一步
                    </Button>
                  </div>

                  {/* ── 联系信息（§7.3：iOS 双列行 + 示例图 + 上传 + 故障描述） ── */}
                  <GroupTitle>联系信息</GroupTitle>
                  <GroupCard>
                    <FieldRow
                      label="联系人（必填）"
                      placeholder="怎么称呼你？"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      maxLength={20}
                      autoComplete="name"
                      error={errors["contactName"]}
                    />
                    <RowDivider />
                    <FieldRow
                      label="联系电话（必填）"
                      placeholder="填写 11 位手机号"
                      type="tel"
                      inputMode="tel"
                      autoComplete="tel"
                      maxLength={11}
                      value={phone}
                      onChange={(e) => setPhone(e.target.value.replace(/[^\d]/g, ""))}
                      error={errors["phone"]}
                    />
                    <RowDivider />
                    <FieldRow
                      label="品牌 / 型号（必填）"
                      placeholder="联想 拯救者 Y7000P"
                      value={brandModel}
                      onChange={(e) => setBrandModel(e.target.value)}
                      maxLength={50}
                      error={errors["brandModel"]}
                    />

                    <details className="model-help">
                      <summary>不知道电脑型号？看这里 <span aria-hidden="true">+</span></summary>
                      <img src="/sample-model-label.jpg" alt="电脑背壳型号标签示例图" width={600} height={400} />
                      <p>型号一般在电脑背面的标签上。也可以填写品牌和大致系列，再上传一张标签照片，我们帮你确认。</p>
                    </details>

                    {/* 型号照片上传（≤3，选填） */}
                    <PhotoUploader
                      label="型号照片"
                      value={modelPhotos}
                      onChange={setModelPhotos}
                      hint={`选填，最多 ${MAX_PHOTOS} 张，单张 ≤5MB`}
                    />
                    <RowDivider />

                    {/* 故障描述 / 补充描述（选「其他」必填，B2） */}
                    <FieldBlock
                      label={isOther ? `补充描述${otherIncludesOther ? "（选「其他」时必填）" : "（选填）"}` : "故障描述（选填）"}
                      rows={3}
                      maxLength={300}
                      value={description}
                      onValueChange={setDescription}
                      placeholder={
                        isOther
                          ? "例如：屏幕碎了 / 连不上 WiFi / 电脑太卡需要重装系统…"
                          : "例如：风扇声音特别大、玩游戏发烫掉帧、开机几分钟就很热…"
                      }
                      error={errors["description"]}
                    />
                  </GroupCard>

                  {/* ── 联系方式（§7.7：微信选中态高亮） ── */}
                  <GroupTitle>联系方式</GroupTitle>
                  <GroupCard className="p-4">
                    <Segmented
                      label="联系偏好"
                      value={pref}
                      onChange={(v) => setPref(v)}
                      options={[
                        { value: "phone", label: CONTACT_PREF_LABELS.phone },
                        { value: "wechat", label: CONTACT_PREF_LABELS.wechat },
                      ]}
                    />
                    <div className="mt-4">
                      {pref === "wechat" ? (
                        /* 选中微信：高亮放大 180–200 + 提示（REQ-17-2，§7.7） */
                        <div className="xx-fade-in rounded-card bg-primary-soft p-4">
                          <p className="mb-3 text-[0.9375rem] font-medium text-label">
                            请先扫码加我们，方便我们通过后联系您
                          </p>
                          <QrCard size={184} highlighted title="扫码加 xiu xiu 官方微信" description="微信里聊也行" />
                        </div>
                      ) : <p className="text-footnote leading-relaxed text-label-2">我们会拨打你预留的手机号，请留意来电。营业时间内 30 分钟内联系，非营业时间次日 9:00 后联系。</p>}

                    </div>
                  </GroupCard>

                  {/* ── 服务方式与时间（§7.3 / §7.6） ── */}
                  <GroupTitle>服务方式与时间</GroupTitle>
                  <GroupCard className="p-4">
                    <Segmented
                      label="服务方式"
                      value={mode}
                      onChange={(v) => setMode(v)}
                      options={[
                        { value: "shop", label: SERVICE_MODE_LABELS.shop },
                        { value: "home", label: SERVICE_MODE_LABELS.home },
                      ]}
                    />

                    {/* 上门规则 Warning 提示条（PRD §7.1 原文，选上门才出现，§7.4） */}
                    {mode === "home" && (
                      <div className="xx-fade-in mt-3">
                        <Notice variant="warning">
                          <span className="whitespace-pre-line">{HOME_SERVICE_NOTICE}</span>
                        </Notice>
                      </div>
                    )}

                    {/* 期望时间：点击弹出 Bottom Sheet（§7.6） */}
                    <div className="mt-3">
                      <RowDivider />
                      <button
                        type="button"
                        onClick={() => setSheetOpen(true)}
                        className="flex w-full items-center justify-between px-4 py-[0.875rem] text-left active:bg-fill"
                        aria-haspopup="dialog"
                      >
                        <span className="text-[1.0625rem] text-label">期望时间</span>
                        <span className="flex items-center gap-1 text-[1.0625rem] text-primary">
                          {preferredTimeLabel(preferredTime)}
                          <ChevronDownIcon className="text-label-3" />
                        </span>
                      </button>
                      <RowDivider />
                    </div>

                    {/* 上门地址（选上门才出现，A10 选填） */}
                    {mode === "home" && (
                      <div className="xx-fade-in">
                        <FieldBlock
                          label="上门地址（选填）"
                          rows={2}
                          maxLength={100}
                          value={address}
                          onValueChange={setAddress}
                          placeholder="XX 小区 X 栋 X 单元（可先留空，联系方式确认时再补）"
                        />
                      </div>
                    )}
                  </GroupCard>


                </div>
              )}
              <div className="booking-submit">
                <div className="booking-bottom glass-bar fixed inset-x-0 bottom-0 z-(--z-footer) border-t border-separator px-4 pt-3 pb-[calc(12px+env(safe-area-inset-bottom,0px))] tablet:static tablet:border-0 tablet:bg-transparent tablet:p-0 tablet:backdrop-blur-none">
                  <div className="mx-auto flex max-w-[40rem] items-center gap-4">
                    <div className="booking-bottom-price shrink-0 tablet:hidden"><small>{isOther ? "维修前确认报价" : "服务价格"}</small>{priceLine}</div>
                    <Button type="submit" block loading={submitting} loadingText="正在提交…">{step === 1 ? "下一步 · 填写信息" : "提交预约"}</Button>
                  </div>
                </div>
                <p>{step === 1 ? "先确认方案，再开始维修。" : "提交即代表同意我们使用以上信息联系你，仅用于本次维修服务。"}</p>
              </div>
            </form>
          </div>

          <aside className="hidden desktop:block desktop:pt-16">
            <div className="sticky top-24">
              <section className="booking-summary" aria-live="polite">
                <p className="eyebrow">YOUR SERVICE / 本次预约</p>
                <h2 className="mt-5">{serviceSummary}</h2>
                <div className="summary-price">{priceSummary}<small>{isOther ? " / 检测免费" : " 起 / 台"}</small></div>
                <div className="summary-rule">
                  <p><ServiceIcon name="check" />{isOther ? "免费检测，报价确认后再维修" : "含 7 天清灰相关问题保修"}</p>
                  <p><ServiceIcon name="home" />到店送修 / 预约上门</p>
                  <p><ServiceIcon name="clock" />每日 9:00–17:00</p>
                </div>
                <p className="mt-5 text-footnote leading-relaxed text-label-2">{isOther ? "具体维修费用，我们会在检测后与你确认。" : "如有额外维修项目，会先与你确认费用。"}无需在线付款。</p>
              </section>
              <div className="summary-help"><p>选不准，或有其他问题？</p><a href={`tel:${SHOP_PHONE}`}>{SHOP_PHONE} ↗</a><p>直接聊聊，我们帮你判断。</p></div>
            </div>
          </aside>
        </div>
      </div>

      {/* 期望时间 Bottom Sheet（§7.6） */}
      <PreferredTimeSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        value={preferredTime}
        onChange={setPreferredTime}
      />

      {/* Toast（§6.11）：去重/限流/服务端异常等非字段级提示 */}
      <Toast open={toast !== null} message={toast ?? ""} onClose={() => setToast(null)} />

      <SiteFooter />
    </main>
  );
}
