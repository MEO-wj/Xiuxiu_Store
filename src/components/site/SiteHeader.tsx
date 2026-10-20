import Link from "next/link";

export function SiteHeader() {
  return <header className="site-header glass-bar"><div className="page-width header-inner">
    <Link href="/" className="brand" aria-label="xiu xiu 首页"><span className="brand-mark" aria-hidden="true">x</span>xiu xiu<span className="brand-category">电脑维修小店</span></Link>
    <Link href="/order" className="header-cta">预约维修 <span aria-hidden="true">↗</span></Link>
  </div></header>;
}
