import { NextResponse } from "next/server";
import { fetchActiveFires } from "@/lib/adapters/firms";

// UNTESTED — see docs/05-api-integration-guide.md §5.3 and the comment atop
// src/lib/adapters/firms.ts. Not wired into the UI until verified.
// Also never build-time-static — see src/app/api/flights/route.ts.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const fires = await fetchActiveFires();
    return NextResponse.json(fires);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upstream FIRMS source unavailable" },
      { status: 502 },
    );
  }
}
