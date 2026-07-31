"use client";

import { Bookmark, Copy, ExternalLink, X } from "lucide-react";
import { useUiStore } from "@/lib/store";
import { usePlaceInfo } from "@/lib/use-place-info";
import { CLIMATE_PERIOD_LABEL } from "@/lib/adapters/place-info";
import { formatPrecipitationMm, formatTemperature } from "@/lib/units";

// Shared template for every event type per docs/02-product-requirements.md
// FR-17/FR-18 — same header/attribute-table/action-row layout regardless of
// whether the selection is an earthquake, flight, ISS, place or wildfire.
//
// Rendered as a self-contained popup: it's absolutely positioned by its
// parent and capped with its own internal scroll, so opening it never
// reflows or displaces the surrounding panels, and it can never grow past
// the viewport on a long Wikipedia summary.
export function EventDetailPanel() {
  const event = useUiStore((s) => s.selectedEvent);
  const setSelectedEvent = useUiStore((s) => s.setSelectedEvent);
  const addBookmark = useUiStore((s) => s.addBookmark);
  const units = useUiStore((s) => s.units);

  // Only fires for place selections — the hook is disabled otherwise.
  const isPlace = event?.kind === "place";
  const {
    data: placeInfo,
    isLoading: placeLoading,
    isError: placeError,
  } = usePlaceInfo(
    isPlace ? (event.placeName ?? event.title) : null,
    isPlace ? event.latitude : null,
    isPlace ? event.longitude : null,
  );

  if (!event) return null;

  function copyCoordinates() {
    if (!event) return;
    navigator.clipboard?.writeText(`${event.latitude.toFixed(5)}, ${event.longitude.toFixed(5)}`);
  }

  const sourceUrl = event.sourceUrl ?? (isPlace ? (placeInfo?.sourceUrl ?? undefined) : undefined);

  return (
    <div
      // Deliberately `region`, not `dialog`: this panel is non-modal — the
      // globe stays interactive behind it and nothing is focus-trapped, so
      // announcing it as a dialog would promise keyboard semantics (focus
      // capture, restore on close) that don't exist here.
      role="region"
      aria-live="polite"
      aria-label={`${event.title} details`}
      className="pointer-events-auto flex max-h-[70vh] w-full flex-col overflow-hidden rounded-2xl border border-white/10 bg-black/70 text-sm text-neutral-100 shadow-2xl backdrop-blur-xl sm:w-80"
    >
      <div className="flex items-start justify-between gap-2 px-4 pt-4">
        <h3 className="text-sm font-medium leading-tight">{event.title}</h3>
        <button
          onClick={() => setSelectedEvent(null)}
          className="shrink-0 text-neutral-500 hover:text-neutral-200"
          aria-label="Close details"
        >
          <X size={14} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-1">
        <div className="mt-3 space-y-1 font-mono text-xs">
          {event.attributes.map((attr) => (
            <div key={attr.label} className="flex justify-between gap-4">
              <span className="text-neutral-500">{attr.label}</span>
              <span className="text-right text-neutral-200">{attr.value}</span>
            </div>
          ))}
        </div>

        {isPlace && (
          <div className="mt-3 border-t border-white/10 pt-3">
            {placeLoading && <p className="text-xs text-neutral-500">Loading place details…</p>}

            {placeError && (
              <p className="text-xs text-neutral-500">Place details unavailable right now.</p>
            )}

            {placeInfo && (
              <>
                {/* Real 1991-2020 WMO climate normals (Open-Meteo), not a
                    current forecast — labelled as such so it isn't mistaken
                    for today's weather. */}
                {(placeInfo.averageTempC != null || placeInfo.annualPrecipitationMm != null) && (
                  <div className="space-y-1 font-mono text-xs">
                    <div className="text-[10px] uppercase tracking-wide text-neutral-500">
                      Climate average · {CLIMATE_PERIOD_LABEL}
                    </div>
                    {placeInfo.averageTempC != null && (
                      <div className="flex justify-between gap-4">
                        <span className="text-neutral-500">Avg temperature</span>
                        <span className="text-right text-neutral-200">
                          {formatTemperature(placeInfo.averageTempC, units)}
                        </span>
                      </div>
                    )}
                    {placeInfo.annualPrecipitationMm != null && (
                      <div className="flex justify-between gap-4">
                        <span className="text-neutral-500">Annual rainfall</span>
                        <span className="text-right text-neutral-200">
                          {formatPrecipitationMm(placeInfo.annualPrecipitationMm, units)}
                        </span>
                      </div>
                    )}
                    <div className="pt-0.5 text-[10px] normal-case text-neutral-600">
                      ERA5 reanalysis via Open-Meteo
                    </div>
                  </div>
                )}

                {placeInfo.summary && (
                  <>
                    <p className="mt-3 text-xs leading-relaxed text-neutral-300">{placeInfo.summary}</p>
                    <p className="mt-2 text-[10px] text-neutral-600">
                      Summary from Wikipedia (CC BY-SA 4.0)
                    </p>
                  </>
                )}
              </>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center gap-3 border-t border-white/10 px-4 py-3 text-xs">
        <button
          onClick={() => addBookmark({ label: event.title, latitude: event.latitude, longitude: event.longitude })}
          className="flex items-center gap-1 text-neutral-300 hover:text-amber-400"
        >
          <Bookmark size={12} /> Bookmark
        </button>
        <button onClick={copyCoordinates} className="flex items-center gap-1 text-neutral-300 hover:text-neutral-100">
          <Copy size={12} /> Copy coords
        </button>
        {sourceUrl && (
          <a
            href={sourceUrl}
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
