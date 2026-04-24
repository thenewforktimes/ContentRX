import { describe, expect, it } from "vitest";
import {
  normalizeText,
  pickBestMatch,
  shortCircuitFromExample,
  type CustomExample,
} from "./custom-examples";

/**
 * Pure-logic tests for the custom-examples module. Runtime DB paths
 * (`findMatchingExample`, `countExamplesForTeam`) are exercised by
 * the API route tests — those require a mocked Drizzle and live in
 * their own file.
 *
 * Human-eval build plan Session 30.
 */

const NOW = new Date("2026-04-24T00:00:00Z");

function entry(overrides: Partial<CustomExample> = {}): CustomExample {
  return {
    id: "ce_test",
    teamOwnerUserId: "team_owner",
    createdByUserId: "admin_user",
    text: "Let's go.",
    normalizedText: "let's go.",
    verdict: "pass",
    moment: null,
    contentType: null,
    standardId: null,
    notes: null,
    contributeUpstream: false,
    createdAt: NOW,
    updatedAt: NOW,
    ...overrides,
  };
}

describe("normalizeText", () => {
  it("lower-cases", () => {
    expect(normalizeText("Hello World")).toBe("hello world");
  });

  it("trims leading + trailing whitespace", () => {
    expect(normalizeText("   save   ")).toBe("save");
  });

  it("collapses internal whitespace runs to a single space", () => {
    expect(normalizeText("Save\t\tchanges\n\nnow")).toBe("save changes now");
  });

  it("is idempotent", () => {
    const input = "  MULTI   word  STRING  ";
    const once = normalizeText(input);
    expect(normalizeText(once)).toBe(once);
  });

  it("preserves punctuation", () => {
    // Entries that ship with a period (e.g. the plan's canonical
    // example "Let's go.") must stay distinct from the period-less
    // variant. That's the whole point of exact match.
    expect(normalizeText("Let's go.")).toBe("let's go.");
    expect(normalizeText("Let's go")).toBe("let's go");
    expect(normalizeText("Let's go.")).not.toBe(normalizeText("Let's go"));
  });
});

describe("pickBestMatch", () => {
  it("returns null when no rows match", () => {
    expect(
      pickBestMatch([], { moment: "confirmation", contentType: "button_cta" }),
    ).toBeNull();
  });

  it("returns the only row when one matches context", () => {
    const only = entry({ moment: "confirmation" });
    const m = pickBestMatch([only], {
      moment: "confirmation",
      contentType: "button_cta",
    });
    expect(m?.id).toBe(only.id);
  });

  it("filters rows whose moment doesn't match the request", () => {
    const wrongMoment = entry({ id: "ce_1", moment: "error_recovery" });
    const m = pickBestMatch([wrongMoment], {
      moment: "confirmation",
      contentType: "button_cta",
    });
    expect(m).toBeNull();
  });

  it("filters rows whose content_type doesn't match the request", () => {
    const wrongType = entry({ id: "ce_1", contentType: "button_cta" });
    const m = pickBestMatch([wrongType], {
      moment: null,
      contentType: "heading",
    });
    expect(m).toBeNull();
  });

  it("keeps moment-agnostic entries (null moment) matching any moment", () => {
    const agnostic = entry({ id: "ce_1", moment: null });
    const m = pickBestMatch([agnostic], {
      moment: "confirmation",
      contentType: null,
    });
    expect(m?.id).toBe(agnostic.id);
  });

  it("prefers the more-specific (moment + content_type) entry when both match", () => {
    const generic = entry({ id: "ce_generic", moment: null, contentType: null });
    const momentScoped = entry({
      id: "ce_moment",
      moment: "confirmation",
      contentType: null,
    });
    const bothScoped = entry({
      id: "ce_both",
      moment: "confirmation",
      contentType: "button_cta",
    });
    const m = pickBestMatch([generic, momentScoped, bothScoped], {
      moment: "confirmation",
      contentType: "button_cta",
    });
    expect(m?.id).toBe("ce_both");
  });
});

describe("shortCircuitFromExample", () => {
  it("returns pass verdict with no violations for a pass entry", () => {
    const sc = shortCircuitFromExample(entry({ verdict: "pass" }));
    expect(sc.verdict).toBe("pass");
    expect(sc.overall_verdict).toBe("pass");
    expect(sc.violations).toEqual([]);
  });

  it("returns violation with a standard_id-cited violation for violation entries", () => {
    const sc = shortCircuitFromExample(
      entry({
        verdict: "violation",
        standardId: "VT-05",
        notes: "Blames the user instead of owning the failure.",
      }),
    );
    expect(sc.verdict).toBe("violation");
    expect(sc.overall_verdict).toBe("fail");
    expect(sc.violations).toHaveLength(1);
    expect(sc.violations[0]!.standard_id).toBe("VT-05");
    expect(sc.violations[0]!.source).toBe("custom_example");
  });

  it("emits a one-hop rationale_chain entry with confidence 1.0", () => {
    const sc = shortCircuitFromExample(
      entry({
        id: "ce_42",
        verdict: "pass",
        notes: "Intentional conversational voice on confirmations.",
      }),
    );
    expect(sc.rationale_hop.step).toBe("custom_example_match");
    expect(sc.rationale_hop.confidence).toBe(1.0);
    expect(sc.rationale_hop.ambiguity_flag).toBeNull();
    expect(sc.rationale_hop.output.matched_example_id).toBe("ce_42");
    expect(sc.rationale_hop.output.verdict).toBe("pass");
  });

  it("annotates rule_versions with `team_custom` when a standard_id is set", () => {
    const sc = shortCircuitFromExample(
      entry({ verdict: "violation", standardId: "VT-05" }),
    );
    expect(sc.rationale_hop.rule_versions).toEqual({ "VT-05": "team_custom" });
  });

  it("leaves rule_versions empty for pass entries without a standard_id", () => {
    const sc = shortCircuitFromExample(
      entry({ verdict: "pass", standardId: null }),
    );
    expect(sc.rationale_hop.rule_versions).toEqual({});
  });

  it("surfaces admin notes on pass entries via the matched_example metadata", () => {
    const sc = shortCircuitFromExample(
      entry({
        verdict: "pass",
        notes: "Intentional — our voice on confirmations.",
      }),
    );
    expect(sc.notes).toBe("Intentional — our voice on confirmations.");
    expect(sc.rationale_hop.output.notes).toBe(
      "Intentional — our voice on confirmations.",
    );
  });
});
