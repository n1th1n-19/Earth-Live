import Script from "next/script";

// Cloudflare Web Analytics — traffic stats (page views, visits, referrers,
// countries, browsers/OS, device type, Core Web Vitals) with no event cap and
// no paid tier. Privacy-first: it sets no cookies and does no cross-site
// fingerprinting, so it needs no consent banner.
//
// Enabled only when NEXT_PUBLIC_CF_BEACON_TOKEN is set (get it from the
// Cloudflare dashboard → Web Analytics → Manage site). With it unset — local
// dev, previews, forks — this renders nothing and loads no third-party script,
// so nobody is measured by accident.
//
// The site does NOT need to be proxied through Cloudflare's DNS for this; the
// beacon posts to https://cloudflareinsights.com/cdn-cgi/rum directly. Both
// that host and static.cloudflareinsights.com are allowlisted in the CSP in
// next.config.ts — without those entries the browser silently blocks it.
export function Analytics() { 
  const token = process.env.NEXT_PUBLIC_CF_BEACON_TOKEN;
  if (!token) return null;

  // Loaded as a classic script even though Cloudflare's dashboard snippet
  // says type="module": the bundle they serve is a plain IIFE with no
  // import/export, and marking it a module makes the browser fetch it in
  // CORS mode, which no longer matches Next's preload — so it gets requested
  // twice for no benefit.
  return (
    <Script
      src="https://static.cloudflareinsights.com/beacon.min.js"
      strategy="afterInteractive"
      data-cf-beacon={JSON.stringify({ token })}
    />
  );
}
