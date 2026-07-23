import { NextResponse } from "next/server";
import { fetchSpaceWeatherEvents } from "@/lib/adapters/nasa-donki";

// UNTESTED — see comment atop src/lib/adapters/nasa-donki.ts. Not wired into
// the UI until verified against a real NASA_API_KEY.
// Also never build-time-static — see src/app/api/flights/route.ts.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const events = await fetchSpaceWeatherEvents();
    return NextResponse.json(events);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upstream NASA DONKI source unavailable" },
      { status: 502 },
    );
  }
}
