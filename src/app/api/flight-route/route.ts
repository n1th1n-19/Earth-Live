import { NextResponse } from "next/server";
import { fetchFlightRoute } from "@/lib/adapters/adsbdb";

// BFF endpoint per docs/03-architecture.md §3.4 — fetched lazily, only for
// the currently-selected flight (see PlacesLayer-sibling FlightsLayer.tsx),
// not proactively for every tracked aircraft.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const callsign = searchParams.get("callsign")?.trim();

  if (!callsign) {
    return NextResponse.json({ error: "callsign query param is required" }, { status: 400 });
  }

  try {
    const route = await fetchFlightRoute(callsign);
    return NextResponse.json(route);
  } catch {
    return NextResponse.json({ error: "Upstream route source unavailable" }, { status: 502 });
  }
}
