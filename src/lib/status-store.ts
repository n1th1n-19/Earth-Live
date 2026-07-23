import type { ApiLogEntry } from "@/lib/api-log";

// Backs the API Status panel (FR-42). This is a process-local ring buffer —
// fine for local dev / a single instance, but Fluid Compute may run multiple
// warm instances in production, so the real implementation should aggregate
// from the `api_logs` table (docs/06-database-design.md) or a shared Redis
// structure, not in-process memory. Flagged here rather than pretended away.
const MAX_ENTRIES_PER_SOURCE = 20;
const history = new Map<string, (ApiLogEntry & { requestedAt: string })[]>();

export function recordStatus(entry: ApiLogEntry & { requestedAt: string }): void {
  const existing = history.get(entry.source) ?? [];
  existing.push(entry);
  if (existing.length > MAX_ENTRIES_PER_SOURCE) existing.shift();
  history.set(entry.source, existing);
}

export interface SourceHealth {
  source: string;
  healthy: boolean;
  successRatePercent: number;
  lastCheckedAt: string;
  lastLatencyMs: number;
  cacheHitRatePercent: number;
}

export function getSourceHealth(): SourceHealth[] {
  return Array.from(history.entries()).map(([source, entries]) => {
    const successCount = entries.filter((e) => e.statusCode == null || e.statusCode < 400).length;
    const cacheHits = entries.filter((e) => e.cacheHit).length;
    const last = entries[entries.length - 1];
    return {
      source,
      healthy: successCount / entries.length >= 0.5,
      successRatePercent: Math.round((successCount / entries.length) * 100),
      lastCheckedAt: last.requestedAt,
      lastLatencyMs: last.latencyMs,
      cacheHitRatePercent: Math.round((cacheHits / entries.length) * 100),
    };
  });
}
