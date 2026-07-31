// Client-side error reporting. Points at GlitchTip (MIT-licensed, free
// hosted tier), which implements Sentry's ingest protocol — so the
// @sentry/nextjs SDK stays exactly as-is and only the DSN changes.
//
// The DSN is read from NEXT_PUBLIC_GLITCHTIP_DSN rather than hardcoded (it
// previously was, committed into the repo). Unset means error reporting is
// simply off — no init, no network calls.
//
// Session Replay is deliberately not enabled: it's a Sentry-specific product
// that GlitchTip does not ingest, so it would ship a sizeable bundle and
// record user sessions with nowhere to send them.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_GLITCHTIP_DSN;

if (dsn) {
  Sentry.init({
    dsn,

    // GlitchTip's free tier allows 1,000 events/month and its own docs
    // recommend ~1% in production; errors are the point here, and a high
    // trace rate would burn the monthly allowance on routine traffic.
    tracesSampleRate: 0.01,

    // Which deploy an error came from. Vercel injects both automatically.
    environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? "development",
    release: process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA,

    // GlitchTip does not implement session tracking, so the release-health
    // sessions the browser SDK sends by default are ingested by nothing.
    // The SDK's old `autoSessionTracking: false` switch (which GlitchTip's
    // setup docs still reference) was removed in v9; in v10 the equivalent
    // is dropping the BrowserSession integration.
    integrations: (defaults) => defaults.filter((i) => i.name !== "BrowserSession"),

    dataCollection: {
      // To disable sending user data and HTTP bodies, uncomment the lines below. For more info visit:
      // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#dataCollection
      // userInfo: false,
      // httpBodies: [],
    },
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
