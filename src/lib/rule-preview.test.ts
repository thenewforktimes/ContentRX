import { describe, expect, it } from "vitest";
import {
  buildRulePreview,
  DEFAULT_SAMPLE_CAP,
  type HistoricalViolationRow,
} from "./rule-preview";

function v(overrides: Partial<HistoricalViolationRow> = {}): HistoricalViolationRow {
  const base: HistoricalViolationRow = {
    id: "v_1",
    standardId: "ACT-01",
    severity: "high",
    moment: "decision_point",
    contentType: "button_cta",
    textHash: "hash_a",
    createdAt: new Date("2026-04-20T00:00:00Z"),
  };
  return { ...base, ...overrides };
}

describe("buildRulePreview — disable", () => {
  it("counts violations that would be removed", () => {
    const violations = [
      v({ id: "1", standardId: "ACT-01", textHash: "h1" }),
      v({ id: "2", standardId: "ACT-01", textHash: "h2" }),
      v({ id: "3", standardId: "TN-01", textHash: "h3" }),
    ];
    const res = buildRulePreview({
      change: { action: "disable", standard_id: "ACT-01" },
      violations,
    });
    expect(res.result.would_remove_violations).toBe(2);
    expect(res.result.would_add_violations).toBe(0);
    expect(res.result.sample_before).toHaveLength(2);
    expect(res.result.sample_after).toEqual([]);
    expect(res.result.note).toBeNull();
  });

  it("reports no-impact note when nothing matches", () => {
    const res = buildRulePreview({
      change: { action: "disable", standard_id: "UNUSED-01" },
      violations: [v({ standardId: "ACT-01" })],
    });
    expect(res.result.would_remove_violations).toBe(0);
    expect(res.result.note).toMatch(/no historical violations/i);
  });

  it("dedupes samples by text_hash", () => {
    const violations = Array.from({ length: 30 }, (_, i) =>
      v({ id: `${i}`, textHash: `h${i % 3}` }),
    );
    const res = buildRulePreview({
      change: { action: "disable", standard_id: "ACT-01" },
      violations,
    });
    expect(res.result.sample_before).toHaveLength(3);
  });

  it("caps samples at DEFAULT_SAMPLE_CAP", () => {
    const violations = Array.from({ length: 50 }, (_, i) =>
      v({ id: `${i}`, textHash: `h${i}` }),
    );
    const res = buildRulePreview({
      change: { action: "disable", standard_id: "ACT-01" },
      violations,
    });
    expect(res.result.sample_before).toHaveLength(DEFAULT_SAMPLE_CAP);
  });
});

describe("buildRulePreview — override", () => {
  it("reports cosmetic-only for severity override not mapping to review", () => {
    const violations = [
      v({ standardId: "ACT-01", severity: "high", textHash: "h1" }),
      v({ standardId: "ACT-01", severity: "high", textHash: "h2" }),
    ];
    const res = buildRulePreview({
      change: {
        action: "override",
        standard_id: "ACT-01",
        override: { severity: "low" },
      },
      violations,
    });
    expect(res.result.would_remove_violations).toBe(0);
    expect(res.result.would_convert_to_review).toBe(0);
    expect(res.result.note).toMatch(/cosmetic|don't filter|present/i);
  });

  it("counts would_convert_to_review when severity maps to review", () => {
    const violations = [
      v({ standardId: "ACT-01", textHash: "h1" }),
      v({ standardId: "ACT-01", textHash: "h2" }),
      v({ standardId: "ACT-01", textHash: "h3" }),
    ];
    const res = buildRulePreview({
      change: {
        action: "override",
        standard_id: "ACT-01",
        override: { severity: "review" },
      },
      violations,
    });
    expect(res.result.would_convert_to_review).toBe(3);
    expect(res.result.sample_after.every((s) => s.severity === "review")).toBe(
      true,
    );
  });
});

describe("buildRulePreview — add", () => {
  it("returns would_add_violations=null with an explanatory note", () => {
    const res = buildRulePreview({
      change: { action: "add", standard_id: "TEAM-01" },
      violations: [v()],
    });
    expect(res.result.would_add_violations).toBeNull();
    expect(res.result.note).toMatch(/regex|raw input|sha256/i);
    expect(res.result.sample_before).toEqual([]);
  });
});

describe("buildRulePreview — unknown action", () => {
  it("fails soft with a note rather than throwing", () => {
    const res = buildRulePreview({
      change: {
        action: "whatever" as unknown as "disable",
        standard_id: "X",
      },
      violations: [],
    });
    expect(res.result.note).toMatch(/unknown rule action/i);
  });
});

describe("buildRulePreview — envelope", () => {
  it("includes schema_version + action + standard_id + window_violations", () => {
    const res = buildRulePreview({
      change: { action: "disable", standard_id: "ACT-01" },
      violations: [v(), v({ standardId: "TN-01" })],
    });
    expect(res.schema_version).toBe("1.0.0");
    expect(res.result.action).toBe("disable");
    expect(res.result.standard_id).toBe("ACT-01");
    expect(res.result.window_violations).toBe(2);
  });
});
