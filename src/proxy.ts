import { NextResponse, type NextRequest } from "next/server";
import { checkRateLimit, clientKeyFromRequest } from "@/lib/rate-limit";

// Rate limits the BFF surface (OWASP API4:2023, unrestricted resource
// consumption). Every /api route proxies a third-party upstream, and most
// take caller-supplied coordinates, so the cache-aside layer protects
// repeated lookups but not a caller walking random lat/lon — which would
// miss the cache every time and spend real quota. GeoNames has a hard daily
// cap and OpenAQ/FIRMS/NASA are keyed, so that quota is exhaustible.
//
// Applied in proxy (Next 16 renamed middleware to proxy) rather than per-route so a newly added route is covered by
// default instead of being remembered about; /api/geocode keeps its own
// stricter limiter for Nominatim's 1 req/s policy.
export const config = {
  matcher: "/api/:path*",
};

// Excluded deliberately:
//  - /api/cron/*  authenticated with CRON_SECRET, and Vercel's scheduler is
//                 not a client we want to throttle.
//  - /api/status  the health surface; throttling it would hide outages
//                 exactly when it is most needed.
const EXEMPT = [/^\/api\/cron\//, /^\/api\/status$/];

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (EXEMPT.some((pattern) => pattern.test(pathname))) return NextResponse.next();

  const { success } = await checkRateLimit(clientKeyFromRequest(request), "api");
  if (!success) {
    return NextResponse.json(
      { error: "Too many requests, try again shortly" },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  return NextResponse.next();
}
