"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ServiceIcon } from "./ServiceIcon";
import { WorkbenchKeys } from "./WorkbenchProps";
import { MotionToggle } from "./HomeExperience";
import { BUSINESS_HOURS_END, BUSINESS_HOURS_START, SHOP_PHONE } from "@/lib/constants";

export function MobileHome({ scene }: { scene: ReactNode }) {
  const [service, setService] = useState<"clean" | "other">("clean");
  return <div className="mobile-home">
    <header className="mobile-shopbar">
      <Link href="/" className="mobile-brand" aria-label="xiu xiu 首页"><span className="brand-mark" aria-hidden="true">x</span><span>xiu xiu<small>电脑维修小店</small></span></Link>
      <a href={`tel:${SHOP_PHONE}`} className="mobile-contact"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m7 3 3 5-2 3c1 3 3 5 6 6l3-2 4 3c-1 4-4 4-6 3C8 18 4 14 2 8 1 5 3 3 7 3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" /></svg>联系小店</a>
    </header>
    <div className="mobile-home-body">
      <section className="mobile-welcome" aria-labelledby="mobile-home-title">
        <p className="mobile-kicker"><span className="status-dot" />认真修电脑，就在你身边</p>
        <h1 id="mobile-home-title">电脑的小状况，<br /><span>交给我们就好。</span></h1>
        <p className="mobile-intro">清灰养护 · 故障维修 · 系统维护</p>
      </section>
      <div className="mobile-workbench">
        <span className="mobile-scene-label" aria-hidden="true">A LITTLE CARE. A FRESH START.</span>
        {scene}
        <WorkbenchKeys />
        <MotionToggle className="mobile-motion-toggle" />
      </div>
      <section className="mobile-services" aria-labelledby="mobile-services-title">
        <div className="mobile-section-heading"><h2 id="mobile-services-title">这次，想解决什么？</h2><span>选好后继续预约</span></div>
        <fieldset className="mobile-service-options"><legend className="sr-only">选择预约服务</legend>
          {([
            { value: "clean", title: "清灰养护", hint: "发烫 / 风扇声音大", icon: "fan" },
            { value: "other", title: "故障维修", hint: "卡顿 / 蓝屏 / 开不了机", icon: "tool" },
          ] as const).map(option => <label key={option.value} className={`mobile-service-option ${service === option.value ? "is-selected" : ""}`}>
            <input type="radio" name="mobile-service" value={option.value} checked={service === option.value} onChange={() => setService(option.value)} />
            <span className="mobile-service-icon"><ServiceIcon name={option.icon} /></span>
            <strong>{option.title}</strong><small>{option.hint}</small><span className="mobile-option-check" aria-hidden="true">{service === option.value ? "✓" : ""}</span>
          </label>)}
        </fieldset>
      </section>
      <div className="mobile-reassurance" aria-live="polite">{service === "clean" ? <><span><ServiceIcon name="check" />报价先确认</span><span><ServiceIcon name="shield" />清灰享 7 天保修</span></> : <><span><ServiceIcon name="search" />免费故障检测</span><span><ServiceIcon name="check" />确认报价后维修</span></>}</div>
      <div className="mobile-shop-info"><span>到店送修 / 预约上门</span><span>每日 {BUSINESS_HOURS_START}:00–{BUSINESS_HOURS_END}:00</span></div>
    </div>
    <div className="mobile-home-dock glass-bar">
      <Link href="/aftersale" className="mobile-aftersale"><ServiceIcon name="shield" />售后报修</Link>
      <Link href={`/order?service=${service}`} className="mobile-booking">{service === "clean" ? "预约清灰养护" : "预约故障维修"}<span aria-hidden="true">→</span></Link>
    </div>
  </div>;
}
