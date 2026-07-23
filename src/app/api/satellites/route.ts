import { NextResponse } from "next/server";
import { fetchSatelliteGroup, type CelesTrakGroup } from "@/lib/adapters/celestrak";

const ALLOWED_GROUPS: CelesTrakGroup[] = ["stations", "active", "weather", "starlink"];

// Live data — never build-time-static. See src/app/api/flights/route.ts.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const group = (searchParams.get("group") ?? "stations") as CelesTrakGroup;

  if (!ALLOWED_GROUPS.includes(group)) {
    return NextResponse.json({ error: "Unknown satellite group" }, { status: 400 });
  }

  try {
    const satellites = await fetchSatelliteGroup(group);
    return NextResponse.json(satellites);
  } catch {
    return NextResponse.json({ error: "Upstream CelesTrak source unavailable" }, { status: 502 });
  }
}
