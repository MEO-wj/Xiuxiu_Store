import { ServiceIcon } from "./ServiceIcon";
import type { CSSProperties } from "react";

export function RepairScene() {
  return <div className="device-scene" role="img" aria-label="笔记本电脑被轻柔的散热气流环绕，清洁后恢复顺畅。插画为装饰展示。">
    <div className="device-aura" />
    <div className="workbench-platform" aria-hidden="true" />
    <div className="device-orbit orbit-one" /><div className="device-orbit orbit-two" />
    <svg className="cooling-air" viewBox="0 0 560 440" fill="none" aria-hidden="true">
      <path className="air-track" d="M46 311C8 244 46 108 153 77c104-31 274-10 322 74M36 333C-1 240 57 78 178 54c123-24 268 9 309 76M94 362c103 69 296 58 374-40 58-73 32-152-9-180" />
      <path className="air-travel air-travel-one" d="M46 311C8 244 46 108 153 77c104-31 274-10 322 74" />
      <path className="air-travel air-travel-two" d="M94 362c103 69 296 58 374-40 58-73 32-152-9-180" />
    </svg>
    <div className="device-parallax">
      <div className="laptop">
        <div className="laptop-lid"><div className="laptop-camera" /><div className="laptop-screen">
          <span className="screen-orb" /><span className="screen-aurora" /><span className="screen-sheen" />
          <span className="screen-check"><svg viewBox="0 0 24 24" fill="none" aria-hidden="true"><path d="m6 12 4 4 8-9" /></svg></span>
          <span className="screen-title">一切，顺畅如初。</span><span className="screen-caption">BACK TO YOUR EVERYDAY.</span>
          <span className="screen-waveform" aria-hidden="true">{Array.from({ length: 17 }, (_, i) => <i key={i} style={{ "--wave-index": i } as CSSProperties} />)}</span>
        </div></div>
        <div className="laptop-base"><span /></div>
      </div>
      <div className="device-note note-top"><span className="note-symbol"><ServiceIcon name="fan" /></span><span>少一点发烫<small>多一点从容</small></span></div>
      <div className="device-note note-bottom"><span className="note-symbol"><ServiceIcon name="check" /></span><span>认真对待每一台<small>也认真对待你的信任</small></span></div>
      <span className="scene-spark spark-one" aria-hidden="true" /><span className="scene-spark spark-two" aria-hidden="true" />
    </div>
    <span className="scene-caption">好好修，也好好用。</span>
  </div>;
}
