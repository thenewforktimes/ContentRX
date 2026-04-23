import { describe, it, expect } from "vitest";
import {
  OVERRIDE_REASON_CODES,
  OVERRIDE_REASON_META,
  overrideReasonOptions,
  typicalTriageCategory,
} from "./override-reasons";

describe("OVERRIDE_REASON_CODES", () => {
  it("has exactly the five codes from the human-eval plan", () => {
    expect(OVERRIDE_REASON_CODES).toHaveLength(5);
    expect(new Set(OVERRIDE_REASON_CODES)).toEqual(
      new Set([
        "not_applicable_here",
        "standard_too_strict",
        "fix_is_worse",
        "shipping_anyway",
        "confusing_need_more_context",
      ]),
    );
  });
});

describe("OVERRIDE_REASON_META", () => {
  it("has one meta entry per code", () => {
    for (const code of OVERRIDE_REASON_CODES) {
      expect(OVERRIDE_REASON_META[code]).toBeDefined();
      expect(OVERRIDE_REASON_META[code].code).toBe(code);
    }
  });

  it("every entry has a non-empty label and description", () => {
    for (const code of OVERRIDE_REASON_CODES) {
      const meta = OVERRIDE_REASON_META[code];
      expect(meta.label.length).toBeGreaterThan(0);
      expect(meta.description.length).toBeGreaterThan(0);
    }
  });

  it("maps each reason to a valid triage_category", () => {
    const validTriage = new Set([
      "context_gap",
      "misclassification",
      "hallucination",
      "missing_standard",
      "correct",
    ]);
    for (const code of OVERRIDE_REASON_CODES) {
      expect(validTriage.has(OVERRIDE_REASON_META[code].typicalTriageCategory))
        .toBe(true);
    }
  });
});

describe("overrideReasonOptions", () => {
  it("returns metas in canonical order matching OVERRIDE_REASON_CODES", () => {
    const options = overrideReasonOptions();
    expect(options.map((o) => o.code)).toEqual([...OVERRIDE_REASON_CODES]);
  });
});

describe("typicalTriageCategory", () => {
  it("follows the plan's documented typical mappings", () => {
    expect(typicalTriageCategory("not_applicable_here")).toBe("context_gap");
    expect(typicalTriageCategory("standard_too_strict")).toBe("missing_standard");
    expect(typicalTriageCategory("fix_is_worse")).toBe("misclassification");
    expect(typicalTriageCategory("shipping_anyway")).toBe("correct");
    expect(typicalTriageCategory("confusing_need_more_context"))
      .toBe("missing_standard");
  });
});
