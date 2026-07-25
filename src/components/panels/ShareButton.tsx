"use client";

import { useState } from "react";
import { Share2, Check } from "lucide-react";
import { useUiStore } from "@/lib/store";
import { encodeViewState } from "@/lib/view-state";

// FR-25/26/27: encodes the current camera position + active layers into a
// shareable URL. Uses the Web Share API where available, falls back to
// clipboard copy.
export function ShareButton() {
  const [copied, setCopied] = useState(false);
  const cameraPosition = useUiStore((s) => s.cameraPosition);
  const activeLayers = useUiStore((s) => s.activeLayers);

  async function share() {
    if (!cameraPosition) return;
    const url = encodeViewState({ ...cameraPosition, layers: activeLayers });

    if (navigator.share) {
      try {
        await navigator.share({ title: "Earth Live", url });
        return;
      } catch {
        // user cancelled the share sheet — fall through to clipboard
      }
    }

    await navigator.clipboard?.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <button
      onClick={share}
      disabled={!cameraPosition}
      className="pointer-events-auto flex items-center gap-2 rounded-full border border-white/10 bg-black/40 px-3 py-2 text-xs text-neutral-300 backdrop-blur-xl hover:bg-black/60 disabled:opacity-50"
      aria-label="Share this view"
    >
      {copied ? <Check size={14} className="text-emerald-400" /> : <Share2 size={14} />}
      {copied ? "Copied" : "Share"}
    </button>
  );
}
