import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchNearbyStations } from "@/lib/adapters/openaq";

// UNTESTED — see comment atop src/lib/adapters/openaq.ts. Not wired into the
// UI until verified against a real OPENAQ_API_KEY.
const querySchema = z.object({
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
});

// Also never build-time-static — see src/app/api/flights/route.ts.
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
    const stations = await fetchNearbyStations(parsed.data.lat, parsed.data.lon);
    return NextResponse.json(stations);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upstream OpenAQ source unavailable" },
      { status: 502 },
    );
  }
}
