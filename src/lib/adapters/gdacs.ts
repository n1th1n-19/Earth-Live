import { z } from "zod";
import { cacheAside } from "@/lib/cache";
import { logApiCall } from "@/lib/api-log";

// GDACS (Global Disaster Alert and Coordination System, run jointly by the
// European Commission and the UN) — free, keyless, verified live. Returns
// currently-active disasters worldwide as GeoJSON points.
//
// Only Orange and Red alerts are requested. GDACS also emits a much larger
// Green tier for routine events, which would bury the situations that
// actually warrant attention; Orange/Red are its "significant" and "severe"
// humanitarian-impact bands.
//
// This deliberately overlaps the USGS earthquake layer without replacing it:
// USGS shows every quake down to small magnitudes, whereas a GDACS EQ entry
// means the event scored a real humanitarian-impact alert. They answer
// different questions and are separate toggles.
const CACHE_TTL_SECONDS = 30 * 60;
const UPSTREAM_TIMEOUT_MS = 15_000;

const EVENT_TYPE_LABELS: Record<string, string> = {
  DR: "Drought",
  EQ: "Earthquake",
  FL: "Flood",
  TC: "Tropical cyclone",
  VO: "Volcano",
  WF: "Wildfire",
};

const featureSchema = z.object({
  geometry: z.object({
    type: z.literal("Point"),
    coordinates: z.tuple([z.number(), z.number()]).rest(z.number()),
  }),
  properties: z.object({
    eventid: z.union([z.number(), z.string()]),
    eventtype: z.string(),
    eventname: z.string().nullable().optional(),
    name: z.string().nullable().optional(),
    description: z.string().nullable().optional(),
    alertlevel: z.string(),
    country: z.string().nullable().optional(),
    fromdate: z.string().nullable().optional(),
    todate: z.string().nullable().optional(),
    severitydata: z
      .object({ severitytext: z.string().nullable().optional() })
      .nullable()
      .optional(),
  }),
});

// Features are validated one at a time rather than as `z.array(featureSchema)`
// so a single malformed entry degrades to "that event is missing" instead of
// blanking the whole layer. GDACS is a live multi-agency feed and does emit
// the occasional record with a null/NaN coordinate or an absent field.
const responseSchema = z.object({
  features: z.array(z.unknown()),
});

export type DisasterAlertLevel = "Orange" | "Red";

export interface Disaster {
  id: string;
  /** Raw GDACS code (EQ, FL, TC, …). */
  type: string;
  /** Human-readable event type, falling back to the raw code if unknown. */
  typeLabel: string;
  title: string;
  country: string | null;
  alertLevel: DisasterAlertLevel;
  severityText: string | null;
  fromDate: string | null;
  latitude: number;
  longitude: number;
}

export async function fetchDisasters(): Promise<Disaster[]> {
  const started = Date.now();
  let statusCode: number | null = null;

  try {
    const { value, cacheHit } = await cacheAside(
      "gdacs:events:orange-red",
      CACHE_TTL_SECONDS,
      async () => {
        const url =
          "https://www.gdacs.org/gdacsapi/api/events/geteventlist/SEARCH?fromDate=&toDate=&alertlevel=Orange;Red";
        const response = await fetch(url, {
          next: { revalidate: 0 },
          signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
          headers: { accept: "application/json" },
        });
        statusCode = response.status;
        if (!response.ok) throw new Error(`GDACS request failed with status ${response.status}`);

        const parsed = responseSchema.parse(await response.json());

        return parsed.features
          .map((raw): Disaster | null => {
            const result = featureSchema.safeParse(raw);
            if (!result.success) return null;

            const feature = result.data;
            const p = feature.properties;
            const [longitude, latitude] = feature.geometry.coordinates;
            // GDACS occasionally emits an event with no usable position;
            // dropping it beats plotting it at 0,0 in the Gulf of Guinea.
            if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
            const alertLevel = p.alertlevel === "Red" ? "Red" : "Orange";

            return {
              id: `${p.eventtype}-${p.eventid}`,
              type: p.eventtype,
              typeLabel: EVENT_TYPE_LABELS[p.eventtype] ?? p.eventtype,
              title: p.eventname?.trim() || p.name?.trim() || p.description?.trim() || "Disaster alert",
              country: p.country?.trim() || null,
              alertLevel,
              severityText: p.severitydata?.severitytext?.trim() || null,
              fromDate: p.fromdate ?? null,
              latitude,
              longitude,
            };
          })
          .filter((d): d is Disaster => d !== null);
      },
    );

    logApiCall({
      source: "gdacs",
      endpoint: "/api/events/geteventlist/SEARCH",
      statusCode,
      latencyMs: Date.now() - started,
      cacheHit,
    });

    return value;
  } catch (err) {
    logApiCall({
      source: "gdacs",
      endpoint: "/api/events/geteventlist/SEARCH",
      statusCode,
      latencyMs: Date.now() - started,
      cacheHit: false,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
