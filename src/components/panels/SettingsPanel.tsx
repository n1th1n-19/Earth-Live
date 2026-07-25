"use client";

import { useState } from "react";
import { Settings as SettingsIcon, X } from "lucide-react";
import { useUiStore } from "@/lib/store";

// docs/02-product-requirements.md FR-34. Only exposes controls that
// actually change behavior (units — see src/lib/units.ts) — no fake
// dropdowns for theme/language, which are genuinely dark-only/English-only
// in this build (docs/04-ui-ux-spec.md §4.2, honestly labeled below rather
// than presented as a working control).
export function SettingsPanel() {
  const [open, setOpen] = useState(false);
  const units = useUiStore((s) => s.units);
  const setUnits = useUiStore((s) => s.setUnits);

  return (
    <div className="pointer-events-auto">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-2 text-xs text-neutral-200 backdrop-blur-xl hover:bg-black/60"
        aria-label="Settings"
      >
        <SettingsIcon size={14} />
      </button>

      {open && (
        <div className="mt-2 w-64 rounded-2xl border border-white/10 bg-black/50 p-3 text-sm text-neutral-100 backdrop-blur-xl shadow-2xl">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs uppercase tracking-wide text-neutral-400">Settings</span>
            <button onClick={() => setOpen(false)} className="flex h-11 w-11 items-center justify-center text-neutral-500 hover:text-neutral-200">
              <X size={14} />
            </button>
          </div>

          <div className="space-y-1">
            <div className="text-xs text-neutral-400">Units</div>
            <div className="flex gap-2">
              {(["metric", "imperial"] as const).map((u) => (
                <button
                  key={u}
                  onClick={() => setUnits(u)}
                  className={`flex-1 rounded-lg px-2 py-1.5 text-xs capitalize ${
                    units === u ? "bg-emerald-500/20 text-emerald-300" : "bg-white/5 text-neutral-400 hover:bg-white/10"
                  }`}
                >
                  {u}
                </button>
              ))}
            </div>
          </div>

          <div className="mt-3 space-y-1 border-t border-white/10 pt-3 text-xs text-neutral-500">
            <div>Theme: Dark (only option in this build)</div>
            <div>Language: English (only option in this build)</div>
          </div>
        </div>
      )}
    </div>
  );
}
