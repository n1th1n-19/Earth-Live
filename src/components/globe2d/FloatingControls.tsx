"use client";

import { Plus, Minus, LocateFixed, Maximize, Camera, Ruler } from "lucide-react";

// docs/04-ui-ux-spec.md §4.4 — zoom, recenter, fullscreen cluster bottom-right.
interface FloatingControlsProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onRecenter: () => void;
  onToggleFullscreen: () => void;
  onScreenshot: () => void;
  onToggleMeasuring: () => void;
  measuring: boolean;
}

export function FloatingControls({
  onZoomIn,
  onZoomOut,
  onRecenter,
  onToggleFullscreen,
  onScreenshot,
  onToggleMeasuring,
  measuring,
}: FloatingControlsProps) {
  // docs/04-ui-ux-spec.md §4.3: "Minimum 44×44px hit area on all
  // interactive controls ... even on desktop for touch-screen laptops."
  // Was h-9 w-9 (36px) — below that minimum.
  const buttonClass =
    "flex h-11 w-11 items-center justify-center rounded-full border border-white/10 bg-black/40 text-neutral-200 backdrop-blur-xl hover:bg-black/60";

  return (
    <div className="pointer-events-auto flex flex-col gap-2">
      <button onClick={onZoomIn} className={buttonClass} title="Zoom in (+)" aria-label="Zoom in">
        <Plus size={18} />
      </button>
      <button onClick={onZoomOut} className={buttonClass} title="Zoom out (-)" aria-label="Zoom out">
        <Minus size={18} />
      </button>
      <button onClick={onRecenter} className={buttonClass} title="Recenter on my location" aria-label="Recenter on my location">
        <LocateFixed size={18} />
      </button>
      <button
        onClick={onToggleMeasuring}
        className={`${buttonClass} ${measuring ? "bg-emerald-500/30 text-emerald-300" : ""}`}
        title="Measure distance"
        aria-label="Toggle measurement tool"
        aria-pressed={measuring}
      >
        <Ruler size={18} />
      </button>
      <button onClick={onScreenshot} className={buttonClass} title="Screenshot" aria-label="Take screenshot">
        <Camera size={18} />
      </button>
      <button onClick={onToggleFullscreen} className={buttonClass} title="Fullscreen (F)" aria-label="Toggle fullscreen">
        <Maximize size={18} />
      </button>
    </div>
  );
}
