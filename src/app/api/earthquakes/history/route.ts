import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";

// Replay mode (FR-29) — queries the durable `cached_earthquakes` history
// (docs/06-database-design.md) that src/lib/adapters/usgs-earthquakes.ts
// persists on every live poll. Coverage only goes back to whenever this
// shipped and started polling — there's no backfill job.
export const dynamic = "force-dynamic";

const querySchema = z.object({
  from: z.coerce.date(),
  to: z.coerce.date(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const parsed = querySchema.safeParse({
    from: searchParams.get("from"),
    to: searchParams.get("to"),
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "from and to query params (ISO dates) are required" }, { status: 400 });
  }

  try {
    const rows = await prisma.cachedEarthquake.findMany({
      where: { occurredAt: { gte: parsed.data.from, lte: parsed.data.to } },
      orderBy: { occurredAt: "asc" },
      take: 2000,
    });

    return NextResponse.json(
      rows.map((r) => ({
        id: r.sourceEventId,
        magnitude: r.magnitude,
        place: r.placeDescription,
        occurredAt: r.occurredAt.toISOString(),
        latitude: r.latitude,
        longitude: r.longitude,
        depthKm: r.depthKm,
      })),
    );
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Database unavailable" },
      { status: 502 },
    );
  }
}
