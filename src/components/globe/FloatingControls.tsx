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
  const buttonClass =
    "flex h-9 w-9 items-center justify-center rounded-full border border-white/10 bg-black/40 text-neutral-200 backdrop-blur-xl hover:bg-black/60";

  return (
    <div className="pointer-events-auto flex flex-col gap-2">
      <button onClick={onZoomIn} className={buttonClass} title="Zoom in">
        <Plus size={16} />
      </button>
      <button onClick={onZoomOut} className={buttonClass} title="Zoom out">
        <Minus size={16} />
      </button>
      <button onClick={onRecenter} className={buttonClass} title="Recenter on my location">
        <LocateFixed size={16} />
      </button>
      <button
        onClick={onToggleMeasuring}
        className={`${buttonClass} ${measuring ? "bg-emerald-500/30 text-emerald-300" : ""}`}
        title="Measure distance"
      >
        <Ruler size={16} />
      </button>
      <button onClick={onScreenshot} className={buttonClass} title="Screenshot">
        <Camera size={16} />
      </button>
      <button onClick={onToggleFullscreen} className={buttonClass} title="Fullscreen">
        <Maximize size={16} />
      </button>
    </div>
  );
}
