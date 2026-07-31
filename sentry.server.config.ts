// Server-side error reporting. Points at GlitchTip (MIT-licensed, free
// hosted tier), which implements Sentry's ingest protocol — the
// @sentry/nextjs SDK is unchanged, only the DSN differs.
//
// Server-only env var (no NEXT_PUBLIC_ prefix) so the DSN isn't inlined into
// the client bundle. Unset means error reporting is off entirely.
import * as Sentry from "@sentry/nextjs";

const dsn = process.env.GLITCHTIP_DSN;

if (dsn) {
  Sentry.init({
    dsn,

    // Sampled low to stay inside GlitchTip's free 1,000 events/month —
    // see the note in src/instrumentation-client.ts.
    tracesSampleRate: 0.01,

    // Which deploy an error came from. Vercel injects both automatically.
    environment: process.env.VERCEL_ENV ?? "development",
    release: process.env.VERCEL_GIT_COMMIT_SHA,

    dataCollection: {
      // To disable sending user data and HTTP bodies, uncomment the lines below. For more info visit:
      // https://docs.sentry.io/platforms/javascript/guides/nextjs/configuration/options/#dataCollection
      // userInfo: false,
      // httpBodies: [],
    },
  });
}
