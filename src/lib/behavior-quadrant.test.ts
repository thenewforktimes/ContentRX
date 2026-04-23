import { describe, it, expect } from "vitest";
import {
  BEHAVIOR_QUADRANTS,
  REFLEX_THRESHOLD_MS,
  deriveBehaviorQuadrant,
  isSuggestionRejectedAlternativeApplied,
  summarizeQuadrants,
} from "./behavior-quadrant";

describe("deriveBehaviorQuadrant", () => {
  describe("pattern_match_accept", () => {
    it("fast accept without expansion", () => {
      expect(
        deriveBehaviorQuadrant({
          stance: "agree",
          rationaleExpanded: false,
          timeToActionMs: 800,
        }),
      ).toBe("pattern_match_accept");
    });

    it("boundary: 1999ms counts as fast", () => {
      expect(
        deriveBehaviorQuadrant({
          stance: "agree",
          rationaleExpanded: false,
          timeToActionMs: REFLEX_THRESHOLD_MS - 1,
        }),
      ).toBe("pattern_match_accept");
    });
  });

  describe("informed_accept", () => {
    it("expanded then agreed (any timing)", () => {
      expect(
        deriveBehaviorQuadrant({
          stance: "agree",
          rationaleExpanded: true,
          timeToActionMs: 100,
        }),
      ).toBe("informed_accept");
      expect(
        deriveBehaviorQuadrant({
          stance: "agree",
          rationaleExpanded: true,
          timeToActionMs: 30_000,
        }),
      ).toBe("informed_accept");
    });

    it("slow accept without expansion — upgraded because user reasoned", () => {
      expect(
        deriveBehaviorQuadrant({
          stance: "agree",
          rationaleExpanded: false,
          timeToActionMs: 5000,
        }),
      ).toBe("informed_accept");
    });

    it("boundary: exactly at 2000ms counts as slow (informed)", () => {
      expect(
        deriveBehaviorQuadrant({
          stance: "agree",
          rationaleExpanded: false,
          timeToActionMs: REFLEX_THRESHOLD_MS,
        }),
      ).toBe("informed_accept");
    });
  });

  describe("informed_reject", () => {
    it("expanded then disagreed", () => {
      expect(
        deriveBehaviorQuadrant({
          stance: "disagree",
          rationaleExpanded: true,
          timeToActionMs: 3000,
        }),
      ).toBe("informed_reject");
    });

    it("slow disagree without expansion", () => {
      expect(
        deriveBehaviorQuadrant({
          stance: "disagree",
          rationaleExpanded: false,
          timeToActionMs: 5000,
        }),
      ).toBe("informed_reject");
    });

    it("agree_but_overriding always lands here regardless of timing", () => {
      expect(
        deriveBehaviorQuadrant({
          stance: "agree_but_overriding",
          rationaleExpanded: true,
          timeToActionMs: 500,
        }),
      ).toBe("informed_reject");
      expect(
        deriveBehaviorQuadrant({
          stance: "agree_but_overriding",
          rationaleExpanded: false,
          timeToActionMs: 10_000,
        }),
      ).toBe("informed_reject");
    });
  });

  describe("reflex_reject", () => {
    it("fast disagree without expansion", () => {
      expect(
        deriveBehaviorQuadrant({
          stance: "disagree",
          rationaleExpanded: false,
          timeToActionMs: 600,
        }),
      ).toBe("reflex_reject");
    });

    it("boundary: 1999ms counts as reflex", () => {
      expect(
        deriveBehaviorQuadrant({
          stance: "disagree",
          rationaleExpanded: false,
          timeToActionMs: REFLEX_THRESHOLD_MS - 1,
        }),
      ).toBe("reflex_reject");
    });
  });

  describe("unknown", () => {
    it("null stance — pre-Session-3 row", () => {
      expect(
        deriveBehaviorQuadrant({
          stance: null,
          rationaleExpanded: null,
          timeToActionMs: null,
        }),
      ).toBe("unknown");
    });

    it("agree with no rationale + no timing", () => {
      expect(
        deriveBehaviorQuadrant({
          stance: "agree",
          rationaleExpanded: null,
          timeToActionMs: null,
        }),
      ).toBe("unknown");
    });

    it("undefined stance", () => {
      expect(
        deriveBehaviorQuadrant({
          stance: undefined,
          rationaleExpanded: false,
          timeToActionMs: 100,
        }),
      ).toBe("unknown");
    });
  });
});

describe("summarizeQuadrants", () => {
  it("tallies all five quadrants with zero for missing", () => {
    const counts = summarizeQuadrants([
      { stance: "agree", rationaleExpanded: false, timeToActionMs: 500 }, // pattern_match_accept
      { stance: "agree", rationaleExpanded: true, timeToActionMs: 5000 }, // informed_accept
      { stance: "disagree", rationaleExpanded: true, timeToActionMs: 3000 }, // informed_reject
      { stance: "disagree", rationaleExpanded: false, timeToActionMs: 500 }, // reflex_reject
      { stance: null, rationaleExpanded: null, timeToActionMs: null }, // unknown
    ]);
    expect(counts).toEqual({
      pattern_match_accept: 1,
      informed_accept: 1,
      informed_reject: 1,
      reflex_reject: 1,
      unknown: 1,
    });
  });

  it("handles empty input", () => {
    const counts = summarizeQuadrants([]);
    for (const q of BEHAVIOR_QUADRANTS) {
      expect(counts[q]).toBe(0);
    }
  });
});

describe("isSuggestionRejectedAlternativeApplied", () => {
  it("true when all three hashes differ", () => {
    expect(
      isSuggestionRejectedAlternativeApplied({
        originalTextHash: "aaa",
        suggestedTextHash: "bbb",
        appliedTextHash: "ccc",
      }),
    ).toBe(true);
  });

  it("false when applied matches original (no rewrite)", () => {
    expect(
      isSuggestionRejectedAlternativeApplied({
        originalTextHash: "aaa",
        suggestedTextHash: "bbb",
        appliedTextHash: "aaa",
      }),
    ).toBe(false);
  });

  it("false when applied matches suggestion (accepted the fix)", () => {
    expect(
      isSuggestionRejectedAlternativeApplied({
        originalTextHash: "aaa",
        suggestedTextHash: "bbb",
        appliedTextHash: "bbb",
      }),
    ).toBe(false);
  });

  it("false when any hash is missing", () => {
    expect(
      isSuggestionRejectedAlternativeApplied({
        originalTextHash: "aaa",
        suggestedTextHash: null,
        appliedTextHash: "ccc",
      }),
    ).toBe(false);
    expect(
      isSuggestionRejectedAlternativeApplied({
        originalTextHash: undefined,
        suggestedTextHash: "bbb",
        appliedTextHash: "ccc",
      }),
    ).toBe(false);
  });
});
