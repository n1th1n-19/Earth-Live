"use client";

import { Wind } from "lucide-react";
import { useAirQuality } from "@/lib/use-air-quality";
import type { UserLocation } from "@/lib/geolocation";

// FR-7 nearby AQI — ground-station readings from OpenAQ (docs/05-api-integration-guide.md
// §5.2). Positive empty state per docs/04-ui-ux-spec.md §4.8: "no station
// nearby" is itself a real, useful finding, not an error.
export function AirQualityPanel({ location }: { location: UserLocation }) {
  const { data, isLoading, isError } = useAirQuality(
    location.resolved ? location.latitude : null,
    location.resolved ? location.longitude : null,
  );

  if (!location.resolved) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-auto w-72 rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-neutral-100 backdrop-blur-xl shadow-2xl"
    >
      {/* pr-6 keeps the heading clear of the overlaid close button (see
          DismissiblePanel). */}
      <div className="flex items-center gap-2 pr-6 text-xs uppercase tracking-wide text-neutral-400">
        <Wind size={14} />
        Air Quality
      </div>

      {isLoading && <div className="mt-2 text-xs text-neutral-500">Checking nearby stations…</div>}
      {isError && <div className="mt-2 text-xs text-red-400">OpenAQ unavailable — retrying automatically.</div>}

      {data === null && (
        <div className="mt-2 text-xs text-neutral-500">No monitoring station within 25 km.</div>
      )}

      {data && (
        <div className="mt-2 space-y-1">
          <div className="text-xs text-neutral-400">{data.stationName}</div>
          <div className="grid grid-cols-2 gap-1 font-mono text-xs">
            {data.measurements.map((m) => (
              <div key={m.parameter} className="flex justify-between gap-2">
                <span className="text-neutral-500 uppercase">{m.displayName}</span>
                <span>
                  {m.value.toFixed(1)} {m.units}
                </span>
              </div>
            ))}
          </div>
          <div className="pt-1 text-[10px] text-neutral-500">Station data: OpenAQ</div>
        </div>
      )}
    </div>
  );
}
