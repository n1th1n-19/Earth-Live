"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Activity, X } from "lucide-react";
import type { SourceHealth } from "@/lib/status-store";

// FR-42: transparency surface listing every upstream source Earth Live
// depends on and its recent success rate — directly supports the "no mock
// data" trust principle. Process-local health for now — see the caveat in
// src/lib/status-store.ts.
export function ApiStatusPanel() {
  const [open, setOpen] = useState(false);
  const { data } = useQuery<SourceHealth[]>({
    queryKey: ["api-status"],
    queryFn: async () => {
      const res = await fetch("/api/status");
      if (!res.ok) return [];
      return res.json();
    },
    refetchInterval: 15_000,
    enabled: open,
  });

  return (
    <div className="pointer-events-auto">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-2 text-xs text-neutral-200 backdrop-blur-xl hover:bg-black/60"
      >
        <Activity size={14} />
        Data sources
      </button>

      {open && (
        <div className="mt-2 w-72 rounded-2xl border border-white/10 bg-black/50 p-3 text-sm text-neutral-100 backdrop-blur-xl shadow-2xl">
          <div className="flex items-center justify-between pb-2">
            <span className="text-xs uppercase tracking-wide text-neutral-400">Data sources</span>
            <button onClick={() => setOpen(false)} className="flex h-11 w-11 items-center justify-center text-neutral-500 hover:text-neutral-200">
              <X size={14} />
            </button>
          </div>
          {(!data || data.length === 0) && (
            <div className="px-1 py-3 text-xs text-neutral-500">
              No calls recorded yet this session — browse a layer to populate this.
            </div>
          )}
          {data?.map((s) => (
            <div key={s.source} className="flex items-center justify-between py-1 font-mono text-xs">
              <span className="flex items-center gap-2">
                <span className={`h-1.5 w-1.5 rounded-full ${s.healthy ? "bg-emerald-400" : "bg-red-400"}`} />
                {s.source}
              </span>
              <span className="text-neutral-500">{s.successRatePercent}% · {s.lastLatencyMs}ms</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
