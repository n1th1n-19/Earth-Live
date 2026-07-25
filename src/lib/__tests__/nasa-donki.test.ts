import { describe, expect, it, vi, afterEach } from "vitest";
import { fetchSpaceWeatherEvents } from "@/lib/adapters/nasa-donki";

const FIXTURE = [
  {
    messageType: "CME",
    messageID: "20260725-AL-001",
    messageIssueTime: "2026-07-25T15:21Z",
    messageBody: "## Community Coordinated Modeling Center Database Of Notifications ".repeat(10),
  },
];

describe("fetchSpaceWeatherEvents", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("throws a clear error when NASA_API_KEY is not configured", async () => {
    vi.stubEnv("NASA_API_KEY", "");
    await expect(fetchSpaceWeatherEvents()).rejects.toThrow(/NASA_API_KEY/);
  });

  it("normalizes DONKI notifications and truncates long summaries", async () => {
    vi.stubEnv("NASA_API_KEY", "testkey");
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify(FIXTURE), { status: 200 })));

    const events = await fetchSpaceWeatherEvents();
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ id: "20260725-AL-001", type: "CME", issuedAt: "2026-07-25T15:21Z" });
    expect(events[0].summary.length).toBeLessThanOrEqual(280);
  });
});
