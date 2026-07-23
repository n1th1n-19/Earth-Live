import { NextResponse } from "next/server";
import { fetchFlights } from "@/lib/adapters/opensky";

// Live data, never build-time-static — without this, Next may classify a
// param-less GET handler as static and execute it once at build time,
// freezing a snapshot forever (and in this route's case, making a slow
// full-global OpenSky fetch block the build). Applied to every route in
// this app for the same reason.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const flights = await fetchFlights();
    return NextResponse.json(flights);
  } catch {
    return NextResponse.json({ error: "Upstream flight source unavailable" }, { status: 502 });
  }
}
