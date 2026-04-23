import { describe, it, expect } from "vitest";
import {
  DEFAULT_PUSHBACK_THRESHOLD,
  FALLBACK_SESSION_WINDOW_MS,
  aggregateOverrides,
  sessionKeyForRow,
  type OverrideRow,
} from "./session-aggregation";

function mkRow(
  id: string,
  standardId: string,
  sessionId: string | null,
  createdAt: string,
  userId: string = "u1",
): OverrideRow {
  return { id, userId, standardId, sessionId, createdAt };
}

describe("aggregateOverrides — threshold behavior", () => {
  it("collapses 3 same-standard-same-session rows into one pushback", () => {
    const rows = [
      mkRow("1", "CLR-01", "scan-a", "2026-04-23T10:00:00Z"),
      mkRow("2", "CLR-01", "scan-a", "2026-04-23T10:00:05Z"),
      mkRow("3", "CLR-01", "scan-a", "2026-04-23T10:00:10Z"),
    ];
    const result = aggregateOverrides(rows);
    expect(result.pushbacks).toHaveLength(1);
    expect(result.singletons).toHaveLength(0);
    expect(result.pushbacks[0].count).toBe(3);
    expect(result.pushbacks[0].standardId).toBe("CLR-01");
    expect(result.pushbacks[0].sessionKey).toBe("scan-a");
  });

  it("leaves 2 same-standard-same-session rows as singletons", () => {
    const rows = [
      mkRow("1", "CLR-01", "scan-a", "2026-04-23T10:00:00Z"),
      mkRow("2", "CLR-01", "scan-a", "2026-04-23T10:00:05Z"),
    ];
    const result = aggregateOverrides(rows);
    expect(result.pushbacks).toHaveLength(0);
    expect(result.singletons).toHaveLength(2);
  });

  it("threshold is configurable", () => {
    const rows = [
      mkRow("1", "CLR-01", "scan-a", "2026-04-23T10:00:00Z"),
      mkRow("2", "CLR-01", "scan-a", "2026-04-23T10:00:05Z"),
    ];
    const result = aggregateOverrides(rows, 2);
    expect(result.pushbacks).toHaveLength(1);
    expect(result.pushbacks[0].count).toBe(2);
  });

  it("DEFAULT_PUSHBACK_THRESHOLD is 3 per the plan", () => {
    expect(DEFAULT_PUSHBACK_THRESHOLD).toBe(3);
  });
});

describe("aggregateOverrides — grouping axes", () => {
  it("different standards in the same session don't merge", () => {
    const rows = [
      mkRow("1", "CLR-01", "scan-a", "2026-04-23T10:00:00Z"),
      mkRow("2", "CLR-01", "scan-a", "2026-04-23T10:00:05Z"),
      mkRow("3", "CLR-01", "scan-a", "2026-04-23T10:00:10Z"),
      mkRow("4", "VT-02", "scan-a", "2026-04-23T10:00:15Z"),
      mkRow("5", "VT-02", "scan-a", "2026-04-23T10:00:20Z"),
    ];
    const result = aggregateOverrides(rows);
    expect(result.pushbacks).toHaveLength(1);
    expect(result.pushbacks[0].standardId).toBe("CLR-01");
    expect(result.singletons).toHaveLength(2);
    expect(result.singletons.every((r) => r.standardId === "VT-02")).toBe(true);
  });

  it("same standard across different sessions doesn't merge", () => {
    const rows = [
      mkRow("1", "CLR-01", "scan-a", "2026-04-23T10:00:00Z"),
      mkRow("2", "CLR-01", "scan-a", "2026-04-23T10:00:05Z"),
      mkRow("3", "CLR-01", "scan-b", "2026-04-23T11:00:00Z"),
      mkRow("4", "CLR-01", "scan-b", "2026-04-23T11:00:05Z"),
    ];
    const result = aggregateOverrides(rows);
    expect(result.pushbacks).toHaveLength(0);
    expect(result.singletons).toHaveLength(4);
  });
});

describe("aggregateOverrides — pseudo-session fallback", () => {
  it("groups null session_id rows by user + 10-minute bucket", () => {
    const rows = [
      // All within the same 10-min bucket → pseudo-session match
      mkRow("1", "CLR-01", null, "2026-04-23T10:00:00Z", "u1"),
      mkRow("2", "CLR-01", null, "2026-04-23T10:03:00Z", "u1"),
      mkRow("3", "CLR-01", null, "2026-04-23T10:06:00Z", "u1"),
    ];
    const result = aggregateOverrides(rows);
    expect(result.pushbacks).toHaveLength(1);
    expect(result.pushbacks[0].count).toBe(3);
    expect(result.pushbacks[0].sessionKey).toMatch(/^pseudo:u1:/);
  });

  it("rows in different 10-minute buckets do NOT pseudo-group", () => {
    const rows = [
      // Two rows in one bucket, one row in the next bucket — no single
      // pseudo-session has ≥3 rows.
      mkRow("1", "CLR-01", null, "2026-04-23T10:00:00Z", "u1"),
      mkRow("2", "CLR-01", null, "2026-04-23T10:05:00Z", "u1"),
      mkRow("3", "CLR-01", null, "2026-04-23T10:20:00Z", "u1"),
    ];
    const result = aggregateOverrides(rows);
    expect(result.pushbacks).toHaveLength(0);
    expect(result.singletons).toHaveLength(3);
  });

  it("different users don't pseudo-group even in the same bucket", () => {
    const rows = [
      mkRow("1", "CLR-01", null, "2026-04-23T10:00:00Z", "u1"),
      mkRow("2", "CLR-01", null, "2026-04-23T10:00:05Z", "u2"),
      mkRow("3", "CLR-01", null, "2026-04-23T10:00:10Z", "u3"),
    ];
    const result = aggregateOverrides(rows);
    expect(result.pushbacks).toHaveLength(0);
    expect(result.singletons).toHaveLength(3);
  });
});

describe("aggregateOverrides — pushback metadata", () => {
  it("orders rows chronologically inside a pushback", () => {
    const rows = [
      mkRow("3", "CLR-01", "scan-a", "2026-04-23T10:00:10Z"),
      mkRow("1", "CLR-01", "scan-a", "2026-04-23T10:00:00Z"),
      mkRow("2", "CLR-01", "scan-a", "2026-04-23T10:00:05Z"),
    ];
    const result = aggregateOverrides(rows);
    expect(result.pushbacks[0].rows.map((r) => r.id)).toEqual(["1", "2", "3"]);
    expect(result.pushbacks[0].firstAt.toISOString())
      .toBe("2026-04-23T10:00:00.000Z");
    expect(result.pushbacks[0].lastAt.toISOString())
      .toBe("2026-04-23T10:00:10.000Z");
  });

  it("produces stable pushback keys of shape sessionKey|standardId", () => {
    const rows = [
      mkRow("1", "CLR-01", "scan-a", "2026-04-23T10:00:00Z"),
      mkRow("2", "CLR-01", "scan-a", "2026-04-23T10:00:05Z"),
      mkRow("3", "CLR-01", "scan-a", "2026-04-23T10:00:10Z"),
    ];
    const result = aggregateOverrides(rows);
    expect(result.pushbacks[0].key).toBe("scan-a|CLR-01");
  });

  it("orders pushbacks newest-first by lastAt", () => {
    const rows = [
      // Group A (older): 3 rows in scan-a at 10:00
      mkRow("1", "CLR-01", "scan-a", "2026-04-23T10:00:00Z"),
      mkRow("2", "CLR-01", "scan-a", "2026-04-23T10:00:05Z"),
      mkRow("3", "CLR-01", "scan-a", "2026-04-23T10:00:10Z"),
      // Group B (newer): 3 rows in scan-b at 11:00
      mkRow("4", "VT-02", "scan-b", "2026-04-23T11:00:00Z"),
      mkRow("5", "VT-02", "scan-b", "2026-04-23T11:00:05Z"),
      mkRow("6", "VT-02", "scan-b", "2026-04-23T11:00:10Z"),
    ];
    const result = aggregateOverrides(rows);
    expect(result.pushbacks.map((p) => p.standardId)).toEqual([
      "VT-02",
      "CLR-01",
    ]);
  });
});

describe("sessionKeyForRow", () => {
  it("returns the supplied session_id when present", () => {
    expect(
      sessionKeyForRow(mkRow("x", "S", "scan-a", "2026-04-23T10:00:00Z")),
    ).toBe("scan-a");
  });

  it("falls back to pseudo:<userId>:<bucket> when session_id is null", () => {
    const key = sessionKeyForRow(
      mkRow("x", "S", null, "2026-04-23T10:00:00Z", "u9"),
    );
    expect(key).toMatch(/^pseudo:u9:\d+$/);
  });

  it("FALLBACK_SESSION_WINDOW_MS matches the 10-minute spec", () => {
    expect(FALLBACK_SESSION_WINDOW_MS).toBe(10 * 60 * 1000);
  });
});

describe("aggregateOverrides — edge cases", () => {
  it("handles empty input", () => {
    expect(aggregateOverrides([])).toEqual({
      pushbacks: [],
      singletons: [],
    });
  });
});
