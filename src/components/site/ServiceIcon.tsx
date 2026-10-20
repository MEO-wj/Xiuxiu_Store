import type { CSSProperties, ReactNode } from "react";

const paths: Record<string, ReactNode> = {
  check: <path d="m5 12 4 4L19 6" />,
  shield: <><path d="m12 3 8 3v6c0 5-8 9-8 9S4 17 4 12V6l8-3Z" /><path d="m8 12 3 3 5-6" /></>,
  search: <><circle cx="10.5" cy="10.5" r="6.5" /><path d="m16 16 5 5" /></>,
  home: <path d="m3 11 9-8 9 8M5 10v11h14V10M10 21v-7h4v7" />,
  clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  spark: <><path d="m12 3 2.5 6.5L21 12l-6.5 2.5L12 21l-2.5-6.5L3 12l6.5-2.5L12 3Z" /><path d="m20 2 .5 1.5L22 4l-1.5.5L20 6l-.5-1.5L18 4l1.5-.5L20 2Z" /></>,
  tool: <path d="m14 6 4 4 3-3a7 7 0 0 1-9 9l-6 6-4-4 6-6a7 7 0 0 1 9-9l-3 3Z" />,
  fan: <><circle cx="12" cy="12" r="2" /><path d="M10 10C3 8 5 2 10 3c3 .5 3 4 2 7m2 0c2-7 8-5 7 0-.5 3-4 3-7 2m0 2c7 2 5 8 0 7-3-.5-3-4-2-7m-2 0c-2 7-8 5-7 0 .5-3 4-3 7-2" /></>,
};

export function ServiceIcon({ name, className, style }: { name: string; className?: string; style?: CSSProperties }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" className={className} style={style}>{paths[name] ?? paths.check}</svg>;
}
