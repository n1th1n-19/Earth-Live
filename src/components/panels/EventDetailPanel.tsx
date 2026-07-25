"use client";

import { Bookmark, Copy, ExternalLink, X } from "lucide-react";
import { useUiStore } from "@/lib/store";

// Shared template for every event type per docs/02-product-requirements.md
// FR-17/FR-18 — same header/attribute-table/action-row layout regardless of
// whether the selection is an earthquake, flight, ISS, or (later) satellite.
export function EventDetailPanel() {
  const event = useUiStore((s) => s.selectedEvent);
  const setSelectedEvent = useUiStore((s) => s.setSelectedEvent);
  const addBookmark = useUiStore((s) => s.addBookmark);

  if (!event) return null;

  function copyCoordinates() {
    if (!event) return;
    navigator.clipboard?.writeText(`${event.latitude.toFixed(5)}, ${event.longitude.toFixed(5)}`);
  }

  return (
    <div
      role="region"
      aria-live="polite"
      aria-label={`${event.title} details`}
      className="pointer-events-auto w-80 rounded-2xl border border-white/10 bg-black/50 p-4 text-sm text-neutral-100 backdrop-blur-xl shadow-2xl"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="text-sm font-medium leading-tight">{event.title}</h3>
        <button onClick={() => setSelectedEvent(null)} className="shrink-0 text-neutral-500 hover:text-neutral-200">
          <X size={14} />
        </button>
      </div>

      <div className="mt-3 space-y-1 font-mono text-xs">
        {event.attributes.map((attr) => (
          <div key={attr.label} className="flex justify-between gap-4">
            <span className="text-neutral-500">{attr.label}</span>
            <span className="text-right text-neutral-200">{attr.value}</span>
          </div>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-3 border-t border-white/10 pt-3 text-xs">
        <button
          onClick={() => addBookmark({ label: event.title, latitude: event.latitude, longitude: event.longitude })}
          className="flex items-center gap-1 text-neutral-300 hover:text-amber-400"
        >
          <Bookmark size={12} /> Bookmark
        </button>
        <button onClick={copyCoordinates} className="flex items-center gap-1 text-neutral-300 hover:text-neutral-100">
          <Copy size={12} /> Copy coords
        </button>
        {event.sourceUrl && (
          <a
            href={event.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-neutral-300 hover:text-neutral-100"
          >
            <ExternalLink size={12} /> Source
          </a>
        )}
      </div>
    </div>
  );
}
