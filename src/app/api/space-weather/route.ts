import { NextResponse } from "next/server";
import { fetchSpaceWeather } from "@/lib/adapters/swpc";

// Live data — never build-time-static. See src/app/api/flights/route.ts.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const data = await fetchSpaceWeather();
    return NextResponse.json(data);
  } catch {
    return NextResponse.json({ error: "Upstream space weather source unavailable" }, { status: 502 });
  }
}
