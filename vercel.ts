import type { VercelConfig } from "@vercel/config/v1";

export const config: VercelConfig = {
  framework: "nextjs",
  buildCommand: "npm run build",

  // Cache pre-warming (src/app/api/cron/prewarm/route.ts). Secured by the
  // CRON_SECRET project env var, which Vercel sends as a bearer token.
  //
  // Daily, because Hobby projects are capped at one cron run per day and a
  // more frequent expression fails the deployment. On a paid plan this wants
  // to be far more frequent — roughly "*/15 * * * *" — which is also what
  // Replay mode needs before its 24h window is genuinely continuous.
  crons: [{ path: "/api/cron/prewarm", schedule: "0 4 * * *" }],
};
