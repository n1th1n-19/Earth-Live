import { recordStatus } from "@/lib/status-store";

// Structured per-call logging for every upstream adapter call.
// Feeds the API Status panel (FR-42) and, in production, the `api_logs`
// table (docs/06-database-design.md) via the log-drain pipeline described in
// docs/03-architecture.md §3.7 — logged here rather than written to Postgres
// per-request, since a DB round trip on every upstream call would defeat the
// point of the cache-aside hot path.
export interface ApiLogEntry {
  source: string;
  endpoint: string;
  statusCode: number | null;
  latencyMs: number;
  cacheHit: boolean;
  errorMessage?: string;
}

export function logApiCall(entry: ApiLogEntry): void {
  const requestedAt = new Date().toISOString();
  console.log(JSON.stringify({ type: "api_log", requestedAt, ...entry }));
  recordStatus({ ...entry, requestedAt });
}
