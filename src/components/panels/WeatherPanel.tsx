"use client";

import { Loader2, MapPin, Mountain, Sun, Wind, Droplets, Cloud } from "lucide-react";
import type { UserLocation } from "@/lib/geolocation";
import { useWeather } from "@/lib/use-weather";
import { useTimezone } from "@/lib/use-timezone";
import { useUiStore } from "@/lib/store";
import { formatTemperature, formatSpeedKmh, formatElevationM } from "@/lib/units";

// WHO/WMO ultraviolet index exposure categories. Colour alone never carries
// the meaning — the band name is rendered alongside it (docs/04-ui-ux-spec.md
// §4.5, "color is never the sole channel").
function uvBand(uv: number): { label: string; className: string } {
  if (uv < 3) return { label: "Low", className: "text-emerald-400" };
  if (uv < 6) return { label: "Moderate", className: "text-yellow-400" };
  if (uv < 8) return { label: "High", className: "text-orange-400" };
  if (uv < 11) return { label: "Very high", className: "text-red-400" };
  return { label: "Extreme", className: "text-fuchsia-400" };
}

// Glass panel per docs/04-ui-ux-spec.md §4.2/§4.4 — floating over the globe,
// never blocking it, progressive population per FR-7 (this panel doesn't
// wait on any other layer to render its own data).
export function WeatherPanel({ location }: { location: UserLocation }) {
  const { data, isLoading, isError } = useWeather(
    location.resolved ? location.latitude : null,
    location.resolved ? location.longitude : null,
  );
  const { data: timezone } = useTimezone(
    location.resolved ? location.latitude : null,
    location.resolved ? location.longitude : null,
  );
  const units = useUiStore((s) => s.units);

  return (
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-auto w-72 rounded-2xl border border-white/10 bg-black/40 p-4 text-sm text-neutral-100 backdrop-blur-xl shadow-2xl"
    >
      {/* pr-6 keeps the location/timezone line clear of the overlaid close
          button (see DismissiblePanel). */}
      <div className="flex items-center gap-2 pr-6 text-xs uppercase tracking-wide text-neutral-400">
        <MapPin size={14} />
        <span>
          {location.source === "gps"
            ? "Your location"
            : location.source === "ip"
              ? "Approximate location"
              : "Default view"}
        </span>
        {timezone && <span className="text-neutral-600">· {timezone.timezoneId}</span>}
      </div>

      {!location.resolved && (
        <div className="mt-3 flex items-center gap-2 text-neutral-400">
          <Loader2 size={14} className="animate-spin" />
          Locating…
        </div>
      )}

      {location.resolved && isLoading && (
        <div className="mt-3 flex items-center gap-2 text-neutral-400">
          <Loader2 size={14} className="animate-spin" />
          Fetching live weather…
        </div>
      )}

      {isError && (
        <div className="mt-3 text-red-400">
          Weather source unavailable — retrying automatically.
        </div>
      )}

      {data && (
        <div className="mt-3 space-y-2">
          <div className="font-mono text-3xl">{formatTemperature(data.temperatureC, units)}</div>
          <div className="text-neutral-400">
            Feels like {formatTemperature(data.apparentTemperatureC, units)}
          </div>
          <div className="grid grid-cols-3 gap-2 pt-2 font-mono text-xs text-neutral-300">
            <div className="flex items-center gap-1">
              <Wind size={12} /> {formatSpeedKmh(data.windSpeedKmh, units)}
            </div>
            <div className="flex items-center gap-1">
              <Droplets size={12} /> {Math.round(data.humidityPercent)}%
            </div>
            <div className="flex items-center gap-1">
              <Cloud size={12} /> {Math.round(data.cloudCoverPercent)}%
            </div>
            {/* UV was already being fetched but never shown. Colour-coded to
                the WHO exposure bands, and paired with the band name so the
                number isn't the only channel carrying the meaning. */}
            {data.uvIndex != null && (
              <div className="flex items-center gap-1" title={`UV index ${data.uvIndex.toFixed(1)}`}>
                <Sun size={12} className={uvBand(data.uvIndex).className} />
                UV {Math.round(data.uvIndex)}
              </div>
            )}
            {data.elevationM != null && (
              <div className="flex items-center gap-1" title="Ground elevation">
                <Mountain size={12} /> {formatElevationM(data.elevationM, units)}
              </div>
            )}
          </div>
          {data.uvIndex != null && (
            <div className={`font-mono text-[10px] ${uvBand(data.uvIndex).className}`}>
              UV {uvBand(data.uvIndex).label}
            </div>
          )}
          <div className="pt-2 text-[10px] text-neutral-500">
            Weather data by Open-Meteo.com · updated{" "}
            {new Date(data.observedAt).toLocaleTimeString()}
          </div>
        </div>
      )}
    </div>
  );
}
