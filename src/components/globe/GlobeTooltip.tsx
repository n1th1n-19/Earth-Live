"use client";

export interface HoverTarget {
  label: string;
  detail?: string;
  /** Canvas-space position of the cursor, in CSS pixels. */
  x: number;
  y: number;
}

// Follows the cursor over the canvas, so it deliberately does NOT live in
// page.tsx's panel stack — it's transient and must not participate in the
// layout of any real panel. pointer-events-none keeps it from ever eating a
// click meant for the entity underneath it.
export function GlobeTooltip({ target }: { target: HoverTarget | null }) {
  if (!target) return null;

  return (
    <div
      className="pointer-events-none absolute z-20 max-w-56 -translate-x-1/2 -translate-y-full rounded-lg border border-white/10 bg-black/80 px-2 py-1 text-xs text-neutral-100 shadow-xl backdrop-blur-md"
      style={{ left: target.x, top: target.y - 14 }}
      role="tooltip"
    >
      <div className="truncate font-medium">{target.label}</div>
      {target.detail && <div className="truncate text-[10px] text-neutral-400">{target.detail}</div>}
    </div>
  );
}
