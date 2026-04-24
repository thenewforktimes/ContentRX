import { describe, expect, it } from "vitest";
import {
  jaccardSimilarity,
  rankSuggestions,
  signalsFromExport,
  type PreferencePairSignal,
} from "./suggestion-ranking";

function signal(
  overrides: Partial<PreferencePairSignal> = {},
): PreferencePairSignal {
  return {
    standardId: "PRF-01",
    moment: "destructive_action",
    preferredText: "Delete account permanently. This can't be undone.",
    nonPreferredText: "Are you sure you want to continue?",
    sampleSize: 5,
    ...overrides,
  };
}

describe("jaccardSimilarity", () => {
  it("returns 0 for empty inputs", () => {
    expect(jaccardSimilarity("", "x")).toBe(0);
    expect(jaccardSimilarity("x", "")).toBe(0);
  });

  it("is symmetric and bounded in [0, 1]", () => {
    const a = "delete the account forever";
    const b = "delete the file forever";
    const s1 = jaccardSimilarity(a, b);
    const s2 = jaccardSimilarity(b, a);
    expect(s1).toBe(s2);
    expect(s1).toBeGreaterThan(0.2);
    expect(s1).toBeLessThanOrEqual(1);
  });

  it("identical text scores 1", () => {
    expect(jaccardSimilarity("hello world", "hello world")).toBe(1);
  });
});

describe("rankSuggestions", () => {
  it("prefers a candidate close to the preferred side", () => {
    const candidates = [
      "Delete account permanently. You can't undo this.",
      "Are you sure you want to continue?",
      "Proceed to the next step.",
    ];
    const ranked = rankSuggestions(candidates, {
      standardId: "PRF-01",
      moment: "destructive_action",
      signals: [signal()],
    });
    expect(ranked[0].originalIndex).toBe(0);
    expect(ranked[0].alignmentScore).toBeGreaterThan(0);
    expect(ranked[ranked.length - 1].originalIndex).toBe(1);
    expect(ranked[ranked.length - 1].alignmentScore).toBeLessThan(0);
  });

  it("ignores signals from different standards", () => {
    const ranked = rankSuggestions(
      ["Delete account permanently.", "Cancel"],
      {
        standardId: "PRF-01",
        moment: "destructive_action",
        signals: [signal({ standardId: "TN-01" })],
      },
    );
    for (const r of ranked) {
      expect(r.alignmentScore).toBe(0);
      expect(r.matchedSignalCount).toBe(0);
    }
  });

  it("half-weights signals when only the standard matches", () => {
    const full = rankSuggestions(
      ["Delete account permanently."],
      {
        standardId: "PRF-01",
        moment: "destructive_action",
        signals: [signal({ moment: "destructive_action" })],
      },
    )[0].alignmentScore;
    const partial = rankSuggestions(
      ["Delete account permanently."],
      {
        standardId: "PRF-01",
        moment: "destructive_action",
        signals: [signal({ moment: "confirmation" })],
      },
    )[0].alignmentScore;
    expect(partial).toBeGreaterThan(0);
    expect(partial).toBeLessThan(full);
  });

  it("is stable across tied scores", () => {
    const ranked = rankSuggestions(["a", "b"], {
      standardId: "PRF-01",
      moment: null,
      signals: [],
    });
    expect(ranked.map((r) => r.originalIndex)).toEqual([0, 1]);
  });

  it("records reasons for matched signals", () => {
    const ranked = rankSuggestions(
      ["Delete account permanently. Irreversible."],
      {
        standardId: "PRF-01",
        moment: "destructive_action",
        signals: [signal()],
      },
    );
    expect(ranked[0].reasons.length).toBeGreaterThan(0);
    expect(ranked[0].reasons[0]).toMatch(/PRF-01@destructive_action/);
  });

  it("scales with sample size sub-linearly", () => {
    const few = rankSuggestions(
      ["Delete account permanently."],
      {
        standardId: "PRF-01",
        moment: "destructive_action",
        signals: [signal({ sampleSize: 1 })],
      },
    )[0].alignmentScore;
    const many = rankSuggestions(
      ["Delete account permanently."],
      {
        standardId: "PRF-01",
        moment: "destructive_action",
        signals: [signal({ sampleSize: 100 })],
      },
    )[0].alignmentScore;
    expect(many).toBeGreaterThan(few);
    expect(many).toBeLessThan(few * 100);
  });
});

describe("signalsFromExport", () => {
  it("skips judgement probes without expected_preferred", () => {
    expect(
      signalsFromExport({
        items: [
          {
            pair: {
              standard_id: "X",
              moment: null,
              expected_preferred: null,
              left_text: "a",
              right_text: "b",
            },
            responses: [{ preferred: "left" }],
          },
        ],
      }),
    ).toEqual([]);
  });

  it("extracts preferred side and aligned sample size", () => {
    const signals = signalsFromExport({
      items: [
        {
          pair: {
            standard_id: "PRF-01",
            moment: "destructive_action",
            expected_preferred: "left",
            left_text: "Delete forever",
            right_text: "Continue",
          },
          responses: [
            { preferred: "left" },
            { preferred: "left" },
            { preferred: "right" },
          ],
        },
      ],
    });
    expect(signals).toHaveLength(1);
    expect(signals[0]).toMatchObject({
      standardId: "PRF-01",
      preferredText: "Delete forever",
      nonPreferredText: "Continue",
      sampleSize: 2,
    });
  });

  it("drops signals under min sample size", () => {
    expect(
      signalsFromExport(
        {
          items: [
            {
              pair: {
                standard_id: "PRF-01",
                moment: "destructive_action",
                expected_preferred: "left",
                left_text: "Delete forever",
                right_text: "Continue",
              },
              responses: [{ preferred: "right" }],
            },
          ],
        },
        1,
      ),
    ).toEqual([]);
  });
});
