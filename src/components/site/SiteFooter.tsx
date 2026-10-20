import Link from "next/link";
import { QrCard } from "@/components/ui";
import { BUSINESS_HOURS_END, BUSINESS_HOURS_START, SHOP_PHONE } from "@/lib/constants";

export function SiteFooter() {
  return <footer className="site-footer"><div className="page-width footer-grid">
    <div><Link href="/" className="brand"><span className="brand-mark" aria-hidden="true">x</span>xiu xiu</Link><p className="footer-description">电脑的小状况，交给我们就好。<br />清灰养护 · 故障维修 · 系统维护</p></div>
    <div className="footer-contact"><p className="footer-label">需要帮助，随时联系</p><a href={`tel:${SHOP_PHONE}`} className="footer-phone">{SHOP_PHONE} ↗</a><p>每日 {BUSINESS_HOURS_START}:00–{BUSINESS_HOURS_END}:00</p><Link href="/aftersale">售后报修 →</Link></div>
    <div className="footer-qr"><QrCard size={88} title="也可以，微信聊" description="添加官方微信咨询" /></div>
  </div><div className="page-width footer-bottom"><span>© xiu xiu · 认真修好每一台电脑</span><span>填写的信息仅用于本次维修服务联系</span></div></footer>;
}
