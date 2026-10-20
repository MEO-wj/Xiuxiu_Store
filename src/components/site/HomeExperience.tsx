"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";

const MotionContext = createContext({ paused: false, toggle: () => {} });

export function MotionToggle({ className = "" }: { className?: string }) {
  const { paused, toggle } = useContext(MotionContext);
  return <button className={`motion-toggle ${className}`} type="button" onClick={toggle} aria-label={paused ? "播放装饰动效" : "暂停装饰动效"} aria-pressed={paused} title={paused ? "播放装饰动效" : "暂停装饰动效"}>
    <svg viewBox="0 0 20 20" fill="none" aria-hidden="true">{paused ? <path d="m7 5 7 5-7 5V5Z" fill="currentColor" /> : <><path d="M7 6v8m6-8v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></>}</svg>
  </button>;
}

/** Keep pointer motion outside React renders; touch and reduced-motion stay still. */
export function HomeExperience({ children }: { children: ReactNode }) {
  const rootRef = useRef<HTMLElement>(null);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    let frame = 0;
    let bounds = root.getBoundingClientRect();
    const reset = () => {
      window.cancelAnimationFrame(frame);
      frame = 0;
      root.style.setProperty("--pointer-x", "0px");
      root.style.setProperty("--pointer-y", "0px");
      root.style.setProperty("--pointer-tilt", "0deg");
    };
    const move = (event: PointerEvent) => {
      if (paused || reducedMotion.matches || !finePointer.matches) return;
      const x = Math.max(-1, Math.min(1, (event.clientX - bounds.left) / bounds.width * 2 - 1));
      const y = Math.max(-1, Math.min(1, (event.clientY - bounds.top) / bounds.height * 2 - 1));
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(() => {
        root.style.setProperty("--pointer-x", `${x * 9}px`);
        root.style.setProperty("--pointer-y", `${y * 6}px`);
        root.style.setProperty("--pointer-tilt", `${x * 1.6}deg`);
        frame = 0;
      });
    };
    const resize = new ResizeObserver(() => { bounds = root.getBoundingClientRect(); });
    resize.observe(root);
    root.addEventListener("pointermove", move, { passive: true });
    root.addEventListener("pointerleave", reset);
    reducedMotion.addEventListener("change", reset);
    finePointer.addEventListener("change", reset);
    return () => {
      reset();
      resize.disconnect();
      root.removeEventListener("pointermove", move);
      root.removeEventListener("pointerleave", reset);
      reducedMotion.removeEventListener("change", reset);
      finePointer.removeEventListener("change", reset);
    };
  }, [paused]);

  return <MotionContext.Provider value={{ paused, toggle: () => setPaused(value => !value) }}><main ref={rootRef} className="marketing-page" data-motion={paused ? "paused" : "running"}>
    {children}
    <MotionToggle className="desktop-motion-toggle" />
  </main></MotionContext.Provider>;
}
