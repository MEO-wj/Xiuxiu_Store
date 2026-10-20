/** A quiet repair workbench: alignment marks, keycaps and a flowing signal. */
export function HomeAtmosphere() {
  return <div className="home-atmosphere" aria-hidden="true">
    <div className="atmosphere-wash" />
    <div className="workbench-grid" />
    <svg className="repair-circuit" viewBox="0 0 1600 900" fill="none" preserveAspectRatio="none">
      <path className="circuit-track" d="M-50 270h180q45 0 70-45l32-55q18-30 55-30h130M1200 110h165q35 0 35 35v70q0 30 30 30h220M-40 795h260q30 0 50-20l30-20q20-15 50-15h80M1080 790h150q40 0 60-30l45-75q20-30 65-30h240" />
      <path className="circuit-pulse" d="M-50 270h180q45 0 70-45l32-55q18-30 55-30h130M1080 790h150q40 0 60-30l45-75q20-30 65-30h240" />
      <g className="circuit-terminals"><circle cx="417" cy="140" r="4" /><circle cx="430" cy="740" r="4" /><circle cx="1200" cy="110" r="4" /><circle cx="1080" cy="790" r="4" /></g>
    </svg>
    <div className="workbench-label"><span /> 小修一下，继续热爱。<small>REPAIR · REFRESH · RESTART</small></div>
    <span className="workbench-cross cross-one" /><span className="workbench-cross cross-two" />
    <div className="workbench-signature"><span className="signature-line" />为你的日常，拧紧每一颗小螺丝。</div>
  </div>;
}
