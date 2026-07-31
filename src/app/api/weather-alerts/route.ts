import { NextResponse } from "next/server";
import { fetchWeatherAlerts } from "@/lib/adapters/nws-alerts";

// Live data — never build-time-static. See src/app/api/flights/route.ts.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const alerts = await fetchWeatherAlerts();
    return NextResponse.json(alerts);
  } catch {
    return NextResponse.json({ error: "Upstream alert source unavailable" }, { status: 502 });
  }
}
