import Script from "next/script";

// Google Analytics 4, enabled only when a real measurement ID is configured
// (NEXT_PUBLIC_GA_ID, e.g. "G-XXXXXXXXXX"). With the variable unset — local
// dev, previews, forks — this renders nothing at all and loads no third-party
// script, so no one is tracked by accident.
//
// `afterInteractive` keeps gtag off the critical path; the globe's WebGL
// startup is what matters for first paint here.
//
// NOTE: the CSP in next.config.ts must allow googletagmanager.com in
// script-src and google-analytics.com in connect-src/img-src for this to
// actually run — see the analytics entries there.
export function Analytics() {
  const gaId = process.env.NEXT_PUBLIC_GA_ID;
  if (!gaId) return null;

  return (
    <>
      <Script
        src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
        strategy="afterInteractive"
      />
      <Script id="ga-init" strategy="afterInteractive">
        {`
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', '${gaId}');
        `}
      </Script>
    </>
  );
}
