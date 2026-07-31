import { NextResponse } from "next/server";
import { fetchActiveFires } from "@/lib/adapters/firms";
import { fetchRecentEarthquakes } from "@/lib/adapters/usgs-earthquakes";

// Scheduled cache pre-warming, invoked by Vercel Cron (see vercel.ts).
//
// The expensive one is FIRMS: the first request in each 3-hour window pulls
// the full global VIIRS feed and takes ~90s, and whichever visitor triggers
// it pays that wait. Running it on a schedule means the Redis entry is
// usually already warm.
//
// Fetching earthquakes here also writes each result into `cached_earthquakes`
// (see fetchRecentEarthquakes), which is the table Replay mode scrubs — so
// every run adds a real snapshot rather than only the ones a live visitor
// happened to trigger.
//
// HOBBY-PLAN LIMIT: Vercel restricts Hobby projects to one cron run per day,
// and a more frequent expression fails the deployment outright. A daily run
// meaningfully pre-warms FIRMS but is far too sparse to make Replay's 24h
// window continuous — that still needs a sub-hourly schedule on a paid plan.
// This is wired correctly and simply runs more often once the plan allows it.
//
// Flights are deliberately not pre-warmed: OpenSky data is stale within
// seconds and the cache TTL is 10s, so a daily fetch would spend quota to
// warm something already expired by the time anyone loads the page.
export const dynamic = "force-dynamic";

// The full FIRMS pull is the slow part; give it room beyond the default.
export const maxDuration = 300;

export async function GET(request: Request) {
  // Vercel sends CRON_SECRET as a bearer token. Without the variable set the
  // endpoint stays closed rather than silently allowing anonymous calls —
  // this route triggers real upstream quota usage and database writes.
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = request.headers.get("authorization");
  if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const started = Date.now();

  // Independent warms — one upstream being down shouldn't skip the other.
  const [fires, quakes] = await Promise.allSettled([
    fetchActiveFires(),
    fetchRecentEarthquakes(),
  ]);

  const result = {
    ok: true,
    durationMs: Date.now() - started,
    wildfires:
      fires.status === "fulfilled"
        ? { status: "warmed", count: fires.value.length }
        : { status: "failed", error: String(fires.reason) },
    earthquakes:
      quakes.status === "fulfilled"
        ? { status: "warmed", count: quakes.value.length }
        : { status: "failed", error: String(quakes.reason) },
  };

  console.log(JSON.stringify({ type: "cron_prewarm", ...result }));

  // Always 200 when authorised: Vercel does not retry failures, and a
  // non-2xx here would only surface as a red cron entry without telling us
  // which source failed. The per-source status above carries that.
  return NextResponse.json(result);
}
