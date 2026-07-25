"use client";

import { useEffect, useRef, useState } from "react";
import { History, Play, Pause, X } from "lucide-react";
import { useUiStore } from "@/lib/store";

// FR-29 Replay mode: scrubs the `cached_earthquakes` history that
// src/lib/adapters/usgs-earthquakes.ts persists on every live poll. Only
// covers whatever's accumulated since this shipped — no backfill job.
// Persistent banner per docs/02-product-requirements.md §2.4.6 so replay is
// never mistaken for the live view.
export function ReplayControls() {
  const replayMode = useUiStore((s) => s.replayMode);
  const setReplayMode = useUiStore((s) => s.setReplayMode);
  const windowStart = useUiStore((s) => s.replayWindowStart);
  const windowEnd = useUiStore((s) => s.replayWindowEnd);
  const cursor = useUiStore((s) => s.replayCursor);
  const setCursor = useUiStore((s) => s.setReplayCursor);

  const [playing, setPlaying] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const startMs = new Date(windowStart).getTime();
  const endMs = new Date(windowEnd).getTime();
  const cursorMs = new Date(cursor).getTime();
  const progress = endMs === startMs ? 0 : (cursorMs - startMs) / (endMs - startMs);

  useEffect(() => {
    if (!playing) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(() => {
      const next = new Date(cursor).getTime() + 30 * 60 * 1000; // 30 simulated minutes/tick
      if (next >= endMs) {
        setCursor(windowEnd);
        setPlaying(false);
      } else {
        setCursor(new Date(next).toISOString());
      }
    }, 200);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  function handleScrub(e: React.ChangeEvent<HTMLInputElement>) {
    const pct = Number(e.target.value) / 1000;
    setCursor(new Date(startMs + pct * (endMs - startMs)).toISOString());
  }

  if (!replayMode) {
    return (
      <button
        onClick={() => setReplayMode(true)}
        className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-2 text-xs text-neutral-200 backdrop-blur-xl hover:bg-black/60"
      >
        <History size={14} />
        Replay
      </button>
    );
  }

  return (
    <div className="pointer-events-auto w-full max-w-xl rounded-2xl border border-amber-500/30 bg-black/70 p-3 text-sm text-neutral-100 backdrop-blur-xl shadow-2xl">
      <div className="flex items-center justify-between pb-2">
        <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-amber-400">
          <History size={14} />
          Replay Mode — not live
        </span>
        <button
          onClick={() => {
            setPlaying(false);
            setReplayMode(false);
          }}
          className="text-neutral-500 hover:text-neutral-200"
          aria-label="Exit replay mode"
        >
          <X size={14} />
        </button>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => setPlaying((v) => !v)}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? <Pause size={14} /> : <Play size={14} />}
        </button>
        <input
          type="range"
          min={0}
          max={1000}
          value={Math.round(progress * 1000)}
          onChange={handleScrub}
          className="w-full accent-amber-400"
          aria-label="Replay time scrubber"
        />
      </div>
      <div className="mt-1 flex justify-between font-mono text-[10px] text-neutral-500">
        <span>{new Date(windowStart).toLocaleString()}</span>
        <span className="text-amber-300">{new Date(cursor).toLocaleString()}</span>
        <span>{new Date(windowEnd).toLocaleString()}</span>
      </div>
    </div>
  );
}
