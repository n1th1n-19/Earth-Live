import { NextResponse } from "next/server";

// Coarse IP-based location fallback (FR-8) sourced from Vercel's own
// edge-inferred geolocation headers — no third-party IP-geolocation API,
// consistent with docs/03-architecture.md §3.8 ("fast first paint hint").
// Headers are absent in local dev; the client falls back to the default
// global view in that case (docs/lib/geolocation.ts).
// Also never build-time-static — see src/app/api/flights/route.ts.
export const dynamic = "force-dynamic";

export function GET(request: Request) {
  const latitude = request.headers.get("x-vercel-ip-latitude");
  const longitude = request.headers.get("x-vercel-ip-longitude");

  if (!latitude || !longitude) {
    return NextResponse.json({ latitude: null, longitude: null });
  }

  return NextResponse.json({
    latitude: Number.parseFloat(latitude),
    longitude: Number.parseFloat(longitude),
  });
}
