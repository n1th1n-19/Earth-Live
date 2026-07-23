import { NextResponse } from "next/server";
import { geocode } from "@/lib/adapters/nominatim";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/rate-limit";

// Live data — never build-time-static. See src/app/api/flights/route.ts.
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { success } = await checkRateLimit(`geocode:${clientKeyFromRequest(request)}`);
  if (!success) {
    return NextResponse.json({ error: "Too many search requests, try again shortly" }, { status: 429 });
  }

  const { searchParams } = new URL(request.url);
  const query = searchParams.get("q") ?? "";

  try {
    const results = await geocode(query);
    return NextResponse.json(results);
  } catch {
    return NextResponse.json({ error: "Upstream geocoding source unavailable" }, { status: 502 });
  }
}
