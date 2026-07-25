import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchNearestAirQuality } from "@/lib/adapters/openaq";

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
    return NextResponse.json({ error: "lat and lon query params are required" }, { status: 400 });
  }

  try {
    const aqi = await fetchNearestAirQuality(parsed.data.lat, parsed.data.lon);
    return NextResponse.json(aqi);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upstream OpenAQ source unavailable" },
      { status: 502 },
    );
  }
}
