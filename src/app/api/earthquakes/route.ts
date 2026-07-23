import { NextResponse } from "next/server";
import { fetchRecentEarthquakes } from "@/lib/adapters/usgs-earthquakes";

// Live data — never build-time-static. See src/app/api/flights/route.ts.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const earthquakes = await fetchRecentEarthquakes();
    return NextResponse.json(earthquakes);
  } catch {
    return NextResponse.json({ error: "Upstream earthquake source unavailable" }, { status: 502 });
  }
}
