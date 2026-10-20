import Link from "next/link";
import { SiteHeader } from "@/components/site/SiteHeader";
import { HomeExperience } from "@/components/site/HomeExperience";
import { HomeAtmosphere } from "@/components/site/HomeAtmosphere";
import { RepairScene } from "@/components/site/RepairScene";
import { WorkbenchProps } from "@/components/site/WorkbenchProps";
import { MobileHome } from "@/components/site/MobileHome";
import { ServiceIcon } from "@/components/site/ServiceIcon";
import { BUSINESS_HOURS_END, BUSINESS_HOURS_START } from "@/lib/constants";

export default function WelcomePage() {
  return (
    <HomeExperience>
      <SiteHeader />
      <HomeAtmosphere />
      <WorkbenchProps />
      <section className="landing-hero page-width">
        <div className="hero-copy">
          <p className="eyebrow"><span className="status-dot" /> 你的身边，认真修电脑的小店</p>
          <h1>电脑的小状况，<br /><span>交给我们就好。</span></h1>
          <p className="hero-description">发烫、卡顿，还是突然开不了机？<br />从清灰养护到故障维修，帮你找回顺畅的日常。</p>
          <div className="hero-actions">
            <Link href="/order" className="action-primary">预约维修 <span aria-hidden="true">↗</span></Link>
            <Link href="/aftersale" className="action-text action-secondary">售后报修 <span aria-hidden="true">↗</span></Link>
          </div>
          <div className="hero-assurances"><span><ServiceIcon name="check" /> 先确认，再维修</span><span><ServiceIcon name="shield" /> 清灰享 7 天保修</span></div>
        </div>
        <RepairScene />
      </section>
      <div className="service-strip"><div className="page-width"><span><ServiceIcon name="search" /> 免费故障检测</span><span><ServiceIcon name="check" /> 报价确认后维修</span><span><ServiceIcon name="home" /> 到店 / 预约上门</span><span><ServiceIcon name="clock" /> 每日 {BUSINESS_HOURS_START}:00–{BUSINESS_HOURS_END}:00</span></div></div>
      <MobileHome scene={<RepairScene />} />
    </HomeExperience>
  );
}
