import { NextResponse } from "next/server";
import { getSourceHealth } from "@/lib/status-store";

// Live data — never build-time-static. See src/app/api/flights/route.ts.
export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json(getSourceHealth());
}
