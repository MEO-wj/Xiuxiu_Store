"use client";

import { useEffect, useRef, type CSSProperties, type PointerEvent, type ReactNode } from "react";

/** Short, damped impulses run only while a prop is being touched. */
function KineticProp({ children, className, label, angle = 0 }: { children: ReactNode; className: string; label: string; angle?: number }) {
  const ref = useRef<HTMLButtonElement>(null);
  const frame = useRef(0);
  const motion = useRef({ x: 0, y: 0, r: 0, vx: 0, vy: 0, vr: 0 });

  useEffect(() => () => window.cancelAnimationFrame(frame.current), []);

  const kick = (direction = 1, pressed = false) => {
    const button = ref.current;
    if (!button || button.closest('[data-motion="paused"]') || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    window.cancelAnimationFrame(frame.current);
    const state = motion.current;
    // Cap repeated touches so fast pointer sweeps cannot fling a prop off screen.
    state.vx = direction * (pressed ? 32 : 100);
    state.vy = pressed ? 95 : -90;
    state.vr = direction * (pressed ? 35 : 85);
    let last = performance.now();
    const animate = (now: number) => {
      if (button.closest('[data-motion="paused"]') || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        Object.assign(state, { x: 0, y: 0, r: 0, vx: 0, vy: 0, vr: 0 });
        button.style.setProperty("--prop-x", "0px");
        button.style.setProperty("--prop-y", "0px");
        button.style.setProperty("--prop-r", "0deg");
        frame.current = 0;
        return;
      }
      const dt = Math.min((now - last) / 1000, 0.032);
      last = now;
      for (const [position, velocity] of [["x", "vx"], ["y", "vy"], ["r", "vr"]] as const) {
        state[velocity] += (-165 * state[position] - 13 * state[velocity]) * dt;
        state[position] = Math.max(-12, Math.min(12, state[position] + state[velocity] * dt));
      }
      button.style.setProperty("--prop-x", `${state.x}px`);
      button.style.setProperty("--prop-y", `${state.y}px`);
      button.style.setProperty("--prop-r", `${state.r}deg`);
      if (Math.abs(state.x) + Math.abs(state.y) + Math.abs(state.r) + Math.abs(state.vx) + Math.abs(state.vy) + Math.abs(state.vr) > 0.15) {
        frame.current = window.requestAnimationFrame(animate);
      } else {
        Object.assign(state, { x: 0, y: 0, r: 0, vx: 0, vy: 0, vr: 0 });
        button.style.setProperty("--prop-x", "0px");
        button.style.setProperty("--prop-y", "0px");
        button.style.setProperty("--prop-r", "0deg");
        frame.current = 0;
      }
    };
    frame.current = window.requestAnimationFrame(animate);
  };

  const direction = (event: PointerEvent<HTMLButtonElement>) => {
    const box = event.currentTarget.getBoundingClientRect();
    return event.clientX < box.left + box.width / 2 ? 1 : -1;
  };

  return <button ref={ref} className={`kinetic-prop ${className}`} style={{ "--rest-angle": `${angle}deg` } as CSSProperties} type="button" aria-label={label}
    onPointerEnter={event => { if (event.pointerType === "mouse") kick(direction(event)); }}
    onPointerDown={event => kick(direction(event), true)}
    onClick={event => { if (event.detail === 0) kick(1, true); }}>
    <span className="prop-bounce"><span className="prop-visual">{children}</span></span>
  </button>;
}

function Screw({ id }: { id: string }) {
  return <svg viewBox="0 0 48 56" fill="none" aria-hidden="true"><defs><linearGradient id={id} x1="17" y1="25" x2="31" y2="25" gradientUnits="userSpaceOnUse"><stop stopColor="#a3afbf" /><stop offset=".45" stopColor="#f8fbff" /><stop offset="1" stopColor="#99a8bc" /></linearGradient></defs><path d="M19 21h10v24l-5 5-5-5V21Z" fill={`url(#${id})`} stroke="#9caabd" strokeWidth=".6" /><path d="m19 28 10-3m-10 9 10-3m-10 9 10-3m-10 9 10-3" stroke="#8799b0" strokeWidth="1.1" /><ellipse cx="24" cy="20" rx="12" ry="5" fill="#b5c1d1" /><ellipse cx="24" cy="17" rx="12" ry="5" fill="#e5ebf4" stroke="#a2afc2" strokeWidth=".6" /><path d="m19 15 10 4m-10 0 10-4" stroke="#8393a9" strokeWidth="1.2" strokeLinecap="round" /></svg>;
}

export function WorkbenchProps() {
  return <div className="workbench-props" role="group" aria-label="可以轻触的小店维修物件">
    <div className="prop-key-pair">
      <KineticProp className="prop-ctrl" label="轻触 Ctrl 键帽" angle={-13}><span className="keycap-model"><span className="keycap-face">ctrl</span></span></KineticProp>
      <KineticProp className="prop-c" label="轻触 C 键帽" angle={10}><span className="keycap-model"><span className="keycap-face">C</span></span></KineticProp>
    </div>
    <KineticProp className="prop-driver" label="轻触精密螺丝刀" angle={-32}>
      <svg viewBox="0 0 220 80" fill="none" aria-hidden="true"><defs>
        <linearGradient id="driver-steel" x1="60" y1="30" x2="60" y2="46" gradientUnits="userSpaceOnUse"><stop stopColor="#91a1b5" /><stop offset=".38" stopColor="#f8fbff" /><stop offset=".65" stopColor="#cdd6e3" /><stop offset="1" stopColor="#7a8ca4" /></linearGradient>
        <linearGradient id="driver-grip" x1="145" y1="22" x2="145" y2="56" gradientUnits="userSpaceOnUse"><stop stopColor="#6784a8" /><stop offset=".24" stopColor="#355b86" /><stop offset=".6" stopColor="#25456b" /><stop offset="1" stopColor="#142c4b" /></linearGradient>
        <linearGradient id="driver-cap" x1="202" y1="20" x2="202" y2="56" gradientUnits="userSpaceOnUse"><stop stopColor="#b9c9dc" /><stop offset=".38" stopColor="#ecf2fa" /><stop offset="1" stopColor="#8eabc9" /></linearGradient>
      </defs><path d="m7 37 18-3 79 1v10H25L7 42v-5Z" fill="url(#driver-steel)" stroke="#8d9db2" strokeWidth=".5" /><path d="M7 37v5l-4-1v-3l4-1Z" fill="#74849a" /><path d="M102 28h17v24h-17a4 4 0 0 1-4-4V32a4 4 0 0 1 4-4Z" fill="url(#driver-cap)" /><path d="M117 23h66c8 0 14 7 14 17s-6 17-14 17h-66c-5 0-9-7-9-17s4-17 9-17Z" fill="url(#driver-grip)" /><path d="M124 28v24m7-25v26m7-26v26m7-26v26m7-26v26m7-26v26m7-26v26m7-26v26" stroke="#8da3c044" strokeWidth="2" /><path d="M185 25h17c6 0 10 6 10 15s-4 15-10 15h-17c5-8 5-22 0-30Z" fill="url(#driver-cap)" /><path d="M199 29h3c3 0 6 5 6 11s-3 11-6 11h-3" stroke="#ffffff99" /><path d="M119 27h58" stroke="#a3b8d35c" strokeLinecap="round" /></svg>
    </KineticProp>
    <KineticProp className="prop-screw prop-screw-one" label="轻触小螺丝" angle={-28}><Screw id="screw-metal-one" /></KineticProp>
    <KineticProp className="prop-screw prop-screw-two" label="轻触小螺丝" angle={24}><Screw id="screw-metal-two" /></KineticProp>
  </div>;
}

/** The phone composition keeps just the two touchable keycaps inside its visual card. */
export function WorkbenchKeys() {
  return <div className="mobile-prop-keys" role="group" aria-label="可以轻触的键帽">
    <KineticProp className="prop-ctrl" label="轻触 Ctrl 键帽" angle={-13}><span className="keycap-model"><span className="keycap-face">ctrl</span></span></KineticProp>
    <KineticProp className="prop-c" label="轻触 C 键帽" angle={10}><span className="keycap-model"><span className="keycap-face">C</span></span></KineticProp>
  </div>;
}
