import { z } from "zod";
import { cacheAside } from "@/lib/cache";
import { logApiCall } from "@/lib/api-log";

// NASA DONKI — docs/05-api-integration-guide.md §5.4.
// UNTESTED: requires a free NASA_API_KEY (api.nasa.gov) which is not
// configured in this environment (the shared DEMO_KEY has a 30 req/hr cap
// too low to rely on). Code follows DONKI's documented notifications shape.
const CACHE_TTL_SECONDS = 60 * 60;

const notificationSchema = z.array(
  z.object({
    messageType: z.string(),
    messageIssueTime: z.string(),
    messageID: z.string(),
    messageBody: z.string(),
  }),
);

export interface SpaceWeatherEvent {
  id: string;
  type: string;
  issuedAt: string;
  summary: string;
}

export async function fetchSpaceWeatherEvents(): Promise<SpaceWeatherEvent[]> {
  const apiKey = process.env.NASA_API_KEY;
  if (!apiKey) {
    throw new Error("NASA_API_KEY is not configured — see .env.example");
  }

  const started = Date.now();
  let statusCode: number | null = null;

  try {
    const { value, cacheHit } = await cacheAside("nasa:donki:notifications", CACHE_TTL_SECONDS, async () => {
      const url = `https://api.nasa.gov/DONKI/notifications?type=all&api_key=${apiKey}`;
      const response = await fetch(url, { next: { revalidate: 0 } });
      statusCode = response.status;
      if (!response.ok) throw new Error(`NASA DONKI request failed with status ${response.status}`);

      const json = await response.json();
      const parsed = notificationSchema.parse(json);
      return parsed.slice(0, 20).map((n) => ({
        id: n.messageID,
        type: n.messageType,
        issuedAt: n.messageIssueTime,
        summary: n.messageBody.slice(0, 280),
      }));
    });

    logApiCall({
      source: "nasa_donki",
      endpoint: "/DONKI/notifications",
      statusCode,
      latencyMs: Date.now() - started,
      cacheHit,
    });

    return value;
  } catch (err) {
    logApiCall({
      source: "nasa_donki",
      endpoint: "/DONKI/notifications",
      statusCode,
      latencyMs: Date.now() - started,
      cacheHit: false,
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }
}
