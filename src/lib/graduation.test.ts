import { describe, it, expect, afterEach } from "vitest";
import {
  ACTOR_ROLE_WEIGHT,
  AUTO_DEMOTION_MIN_VIOLATIONS,
  AUTO_DEMOTION_THRESHOLD,
  AUTO_DEMOTION_WINDOW_DAYS,
  GRADUATION_LEVELS,
  LEVEL_CONSEQUENCES,
  canApproveGraduation,
  demoteOneStep,
  isPromotion,
  levelRank,
  shouldAutoDemote,
  weightedOverrideCount,
} from "./graduation";

describe("GRADUATION_LEVELS", () => {
  it("is the three-step ladder in ascending order", () => {
    expect(GRADUATION_LEVELS).toEqual([
      "robo_labels",
      "batch_approval",
      "autonomous",
    ]);
  });
});

describe("levelRank", () => {
  it("assigns ascending ranks", () => {
    expect(levelRank("robo_labels")).toBeLessThan(levelRank("batch_approval"));
    expect(levelRank("batch_approval")).toBeLessThan(levelRank("autonomous"));
  });
});

describe("isPromotion", () => {
  it("flags strict promotions", () => {
    expect(isPromotion("robo_labels", "batch_approval")).toBe(true);
    expect(isPromotion("robo_labels", "autonomous")).toBe(true);
    expect(isPromotion("batch_approval", "autonomous")).toBe(true);
  });

  it("rejects demotions", () => {
    expect(isPromotion("autonomous", "batch_approval")).toBe(false);
    expect(isPromotion("batch_approval", "robo_labels")).toBe(false);
  });

  it("rejects same-level", () => {
    expect(isPromotion("batch_approval", "batch_approval")).toBe(false);
  });
});

describe("LEVEL_CONSEQUENCES", () => {
  it("has a non-empty string per level", () => {
    for (const lvl of GRADUATION_LEVELS) {
      expect(LEVEL_CONSEQUENCES[lvl]).toBeTypeOf("string");
      expect(LEVEL_CONSEQUENCES[lvl].length).toBeGreaterThan(10);
    }
  });

  it("mentions rollback triggers on batch + autonomous copy", () => {
    expect(LEVEL_CONSEQUENCES.batch_approval).toMatch(/rollback/i);
    expect(LEVEL_CONSEQUENCES.autonomous).toMatch(/rollback/i);
  });
});

describe("canApproveGraduation", () => {
  const orig = process.env.CONTENTRX_ADMIN_CLERK_IDS;
  afterEach(() => {
    if (orig === undefined) delete process.env.CONTENTRX_ADMIN_CLERK_IDS;
    else process.env.CONTENTRX_ADMIN_CLERK_IDS = orig;
  });

  it("returns false when the allow-list is unset", () => {
    delete process.env.CONTENTRX_ADMIN_CLERK_IDS;
    expect(canApproveGraduation("user_123")).toBe(false);
  });

  it("returns false when the allow-list is empty", () => {
    process.env.CONTENTRX_ADMIN_CLERK_IDS = "";
    expect(canApproveGraduation("user_123")).toBe(false);
  });

  it("returns false for a user not on the allow-list", () => {
    process.env.CONTENTRX_ADMIN_CLERK_IDS = "user_999";
    expect(canApproveGraduation("user_123")).toBe(false);
  });

  it("returns true for a user on the allow-list", () => {
    process.env.CONTENTRX_ADMIN_CLERK_IDS = "user_123";
    expect(canApproveGraduation("user_123")).toBe(true);
  });

  it("handles comma-separated allow-list entries + trims whitespace", () => {
    process.env.CONTENTRX_ADMIN_CLERK_IDS = "user_a,  user_b ,user_c";
    expect(canApproveGraduation("user_a")).toBe(true);
    expect(canApproveGraduation("user_b")).toBe(true);
    expect(canApproveGraduation("user_c")).toBe(true);
    expect(canApproveGraduation("user_d")).toBe(false);
  });

  it("returns false for null / undefined clerkIds", () => {
    process.env.CONTENTRX_ADMIN_CLERK_IDS = "user_123";
    expect(canApproveGraduation(null)).toBe(false);
    expect(canApproveGraduation(undefined)).toBe(false);
    expect(canApproveGraduation("")).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Session 12 — demotion helpers
// ---------------------------------------------------------------------------

describe("demoteOneStep", () => {
  it("autonomous falls back to batch_approval", () => {
    expect(demoteOneStep("autonomous")).toBe("batch_approval");
  });

  it("batch_approval falls back to robo_labels", () => {
    expect(demoteOneStep("batch_approval")).toBe("robo_labels");
  });

  it("robo_labels is the floor — no-op", () => {
    expect(demoteOneStep("robo_labels")).toBe("robo_labels");
  });
});

describe("AUTO_DEMOTION_THRESHOLD", () => {
  it("mirrors Session 10 graduation cutoffs for autonomous + batch", () => {
    expect(AUTO_DEMOTION_THRESHOLD.autonomous).toBe(0.05);
    expect(AUTO_DEMOTION_THRESHOLD.batch_approval).toBe(0.10);
  });

  it("robo_labels threshold is Infinity so the floor never trips", () => {
    expect(AUTO_DEMOTION_THRESHOLD.robo_labels).toBe(Infinity);
  });

  it("window is 14 days per plan spec", () => {
    expect(AUTO_DEMOTION_WINDOW_DAYS).toBe(14);
  });

  it("min-denominator floor is 10 violations", () => {
    expect(AUTO_DEMOTION_MIN_VIOLATIONS).toBe(10);
  });
});

describe("shouldAutoDemote", () => {
  it("fires when autonomous rate ≥ 5% with enough volume", () => {
    expect(shouldAutoDemote("autonomous", 0.05, 20)).toBe(true);
    expect(shouldAutoDemote("autonomous", 0.12, 100)).toBe(true);
  });

  it("does not fire when autonomous rate is below threshold", () => {
    expect(shouldAutoDemote("autonomous", 0.04, 100)).toBe(false);
    expect(shouldAutoDemote("autonomous", 0.00, 100)).toBe(false);
  });

  it("fires when batch rate ≥ 10% with enough volume", () => {
    expect(shouldAutoDemote("batch_approval", 0.10, 50)).toBe(true);
    expect(shouldAutoDemote("batch_approval", 0.25, 100)).toBe(true);
  });

  it("does not fire when batch rate is below threshold", () => {
    expect(shouldAutoDemote("batch_approval", 0.08, 50)).toBe(false);
  });

  it("suppresses firing when denominator is below the floor", () => {
    // High rate but tiny denominator — likely noise, not drift.
    expect(shouldAutoDemote("autonomous", 0.50, 5)).toBe(false);
    expect(shouldAutoDemote("batch_approval", 0.50, 9)).toBe(false);
  });

  it("never fires on robo_labels", () => {
    expect(shouldAutoDemote("robo_labels", 0.99, 9999)).toBe(false);
  });
});

describe("weightedOverrideCount", () => {
  it("weights designer > pm > engineer", () => {
    expect(weightedOverrideCount([{ actorRole: "designer" }])).toBe(1.5);
    expect(weightedOverrideCount([{ actorRole: "pm" }])).toBe(1.0);
    expect(weightedOverrideCount([{ actorRole: "engineer" }])).toBe(0.75);
  });

  it("unknown + null roles fall back to 1.0", () => {
    expect(weightedOverrideCount([{ actorRole: null }])).toBe(1.0);
    expect(weightedOverrideCount([{ actorRole: "other" }])).toBe(1.0);
    expect(weightedOverrideCount([{ actorRole: "intern" }])).toBe(1.0);
  });

  it("sums correctly across a mixed batch", () => {
    expect(
      weightedOverrideCount([
        { actorRole: "designer" },
        { actorRole: "engineer" },
        { actorRole: null },
      ]),
    ).toBe(1.5 + 0.75 + 1.0);
  });

  it("empty → 0", () => {
    expect(weightedOverrideCount([])).toBe(0);
  });
});

describe("ACTOR_ROLE_WEIGHT", () => {
  it("exposes the canonical weight table", () => {
    expect(ACTOR_ROLE_WEIGHT.designer).toBeGreaterThan(ACTOR_ROLE_WEIGHT.pm);
    expect(ACTOR_ROLE_WEIGHT.pm).toBeGreaterThan(ACTOR_ROLE_WEIGHT.engineer);
  });
});
