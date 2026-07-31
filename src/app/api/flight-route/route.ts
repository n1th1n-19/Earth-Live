import { NextResponse } from "next/server";
import { fetchFlightRoute } from "@/lib/adapters/adsbdb";

// BFF endpoint per docs/03-architecture.md §3.4 — fetched lazily, only for
// the currently-selected flight (see PlacesLayer-sibling FlightsLayer.tsx),
// not proactively for every tracked aircraft.
export const dynamic = "force-dynamic";

// Real ICAO callsigns are short and strictly alphanumeric (3-letter airline
// prefix + flight number, e.g. BAW123). Validating the shape here keeps
// arbitrary user-supplied strings out of the upstream URL and out of the
// Redis cache keyspace.
const CALLSIGN_PATTERN = /^[A-Za-z0-9]{2,8}$/;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const callsign = searchParams.get("callsign")?.trim();

  if (!callsign || !CALLSIGN_PATTERN.test(callsign)) {
    return NextResponse.json(
      { error: "callsign query param is required and must be 2-8 alphanumeric characters" },
      { status: 400 },
    );
  }

  try {
    const route = await fetchFlightRoute(callsign);
    return NextResponse.json(route);
  } catch {
    return NextResponse.json({ error: "Upstream route source unavailable" }, { status: 502 });
  }
}
