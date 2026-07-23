import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchTimezone } from "@/lib/adapters/geonames";

// UNTESTED — see comment atop src/lib/adapters/geonames.ts. The client uses
// `Intl.DateTimeFormat` directly for the user's own device (zero-cost, no
// route needed); this endpoint is only for arbitrary map coordinates.
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
    const timezone = await fetchTimezone(parsed.data.lat, parsed.data.lon);
    return NextResponse.json(timezone);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upstream GeoNames source unavailable" },
      { status: 502 },
    );
  }
}
