import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchPlaceInfo } from "@/lib/adapters/place-info";

// BFF endpoint per docs/03-architecture.md §3.4 — fetched lazily, only when
// a place marker is actually selected.
export const dynamic = "force-dynamic";

const querySchema = z.object({
  name: z.string().min(1).max(120),
  lat: z.coerce.number().min(-90).max(90),
  lon: z.coerce.number().min(-180).max(180),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    name: searchParams.get("name"),
    lat: searchParams.get("lat"),
    lon: searchParams.get("lon"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "name, lat and lon query params are required and must be valid" },
      { status: 400 },
    );
  }

  try {
    const info = await fetchPlaceInfo(parsed.data.name, parsed.data.lat, parsed.data.lon);
    return NextResponse.json(info);
  } catch {
    return NextResponse.json({ error: "Upstream place-info source unavailable" }, { status: 502 });
  }
}
