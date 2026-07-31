import { NextResponse } from "next/server";
import { fetchDisasters } from "@/lib/adapters/gdacs";

// Live data — never build-time-static. See src/app/api/flights/route.ts.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const disasters = await fetchDisasters();
    return NextResponse.json(disasters);
  } catch {
    return NextResponse.json({ error: "Upstream disaster source unavailable" }, { status: 502 });
  }
}
