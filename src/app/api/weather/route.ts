import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchCurrentWeather } from "@/lib/adapters/open-meteo";

// BFF endpoint per docs/03-architecture.md §3.4 — the client never calls
// Open-Meteo directly; this route owns caching, validation, and logging.
const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
});

// Live data — never build-time-static. See src/app/api/flights/route.ts.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    lat: searchParams.get("lat"),
    lon: searchParams.get("lon"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "lat and lon query params are required and must be valid coordinates" },
      { status: 400 },
    );
  }

  try {
    const weather = await fetchCurrentWeather(parsed.data.lat, parsed.data.lon);
    return NextResponse.json(weather);
  } catch {
    return NextResponse.json(
      { error: "Upstream weather source unavailable" },
      { status: 502 },
    );
  }
}
