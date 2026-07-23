"use client";

import { useState } from "react";
import { useUiStore } from "@/lib/store";

// FR-24: always-visible cursor coordinate readout, decimal <-> DMS on click.
function toDms(value: number, positiveSuffix: string, negativeSuffix: string): string {
  const suffix = value >= 0 ? positiveSuffix : negativeSuffix;
  const abs = Math.abs(value);
  const degrees = Math.floor(abs);
  const minutesFull = (abs - degrees) * 60;
  const minutes = Math.floor(minutesFull);
  const seconds = ((minutesFull - minutes) * 60).toFixed(1);
  return `${degrees}°${minutes}'${seconds}"${suffix}`;
}

export function CoordinateReadout() {
  const coords = useUiStore((s) => s.cursorCoordinates);
  const [dms, setDms] = useState(false);

  if (!coords) return null;

  const label = dms
    ? `${toDms(coords.latitude, "N", "S")} ${toDms(coords.longitude, "E", "W")}`
    : `${coords.latitude.toFixed(5)}, ${coords.longitude.toFixed(5)}`;

  return (
    <button
      onClick={() => setDms((v) => !v)}
      className="pointer-events-auto rounded-full border border-white/10 bg-black/40 px-3 py-1.5 font-mono text-[11px] text-neutral-300 backdrop-blur-xl hover:text-neutral-100"
      title="Click to toggle decimal / DMS"
    >
      {label}
    </button>
  );
}
