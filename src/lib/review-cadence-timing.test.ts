import { describe, expect, it } from "vitest";
import {
  CADENCE_SPECS,
  cadenceSpec,
  evaluateAllCadences,
  evaluateCadence,
  statusMessage,
} from "./review-cadence-timing";

const NOW = new Date("2026-04-24T12:00:00Z");
const DAY = 24 * 60 * 60 * 1000;

describe("CADENCE_SPECS", () => {
  it("covers all four cadence kinds", () => {
    const kinds = CADENCE_SPECS.map((s) => s.kind).sort();
    expect(kinds).toEqual(["annual", "monthly", "quarterly", "weekly"]);
  });

  it("flags the quarterly cadence as load-bearing", () => {
    const quarterly = cadenceSpec("quarterly");
    expect(quarterly.loadBearing).toBe(true);
    const weekly = cadenceSpec("weekly");
    expect(weekly.loadBearing).toBe(false);
  });
});

describe("evaluateCadence", () => {
  it("returns eligible + empty fields for a cadence that's never completed", () => {
    const snap = evaluateCadence("weekly", null, NOW);
    expect(snap.status).toBe("eligible");
    expect(snap.lastCompletedAt).toBeNull();
    expect(snap.nextDueAt).toBeNull();
    expect(snap.daysOverdue).toBe(0);
  });

  it("is on_track when next due is in the future", () => {
    const twoDaysAgo = new Date(NOW.getTime() - 2 * DAY);
    const snap = evaluateCadence("weekly", twoDaysAgo, NOW);
    expect(snap.status).toBe("on_track");
    expect(snap.daysOverdue).toBe(0);
    expect(snap.nextDueAt?.getTime()).toBe(twoDaysAgo.getTime() + 7 * DAY);
  });

  it("is eligible during grace window after interval elapses", () => {
    // Weekly: 7d interval + 3d grace. 8d ago → due but inside grace.
    const eightDaysAgo = new Date(NOW.getTime() - 8 * DAY);
    const snap = evaluateCadence("weekly", eightDaysAgo, NOW);
    expect(snap.status).toBe("eligible");
    expect(snap.daysOverdue).toBe(1);
  });

  it("is overdue once grace window passes", () => {
    // Weekly: 7d interval + 3d grace. 12d ago → 5d overdue, past grace.
    const twelveDaysAgo = new Date(NOW.getTime() - 12 * DAY);
    const snap = evaluateCadence("weekly", twelveDaysAgo, NOW);
    expect(snap.status).toBe("overdue");
    expect(snap.daysOverdue).toBe(5);
  });

  it("uses the right thresholds per cadence kind", () => {
    // Quarterly: 91d interval + 21d grace. Last ran 100d ago → eligible.
    const hundredDaysAgo = new Date(NOW.getTime() - 100 * DAY);
    const quarterly = evaluateCadence("quarterly", hundredDaysAgo, NOW);
    expect(quarterly.status).toBe("eligible");

    // 115d ago → overdue (past 112d grace boundary).
    const extraLate = new Date(NOW.getTime() - 115 * DAY);
    expect(evaluateCadence("quarterly", extraLate, NOW).status).toBe("overdue");
  });

  it("handles a cadence that just completed today", () => {
    const snap = evaluateCadence("monthly", NOW, NOW);
    expect(snap.status).toBe("on_track");
    expect(snap.daysOverdue).toBe(0);
  });
});

describe("evaluateAllCadences", () => {
  it("returns one snapshot per cadence and preserves spec order", () => {
    const snaps = evaluateAllCadences({}, NOW);
    expect(snaps.map((s) => s.kind)).toEqual([
      "weekly",
      "monthly",
      "quarterly",
      "annual",
    ]);
    for (const snap of snaps) {
      expect(snap.status).toBe("eligible");
    }
  });

  it("mixes on_track + overdue correctly", () => {
    const recent = new Date(NOW.getTime() - 3 * DAY);
    const stale = new Date(NOW.getTime() - 200 * DAY);
    const snaps = evaluateAllCadences(
      { weekly: recent, quarterly: stale },
      NOW,
    );
    const weekly = snaps.find((s) => s.kind === "weekly")!;
    const quarterly = snaps.find((s) => s.kind === "quarterly")!;
    expect(weekly.status).toBe("on_track");
    expect(quarterly.status).toBe("overdue");
  });
});

describe("statusMessage", () => {
  it("calls out load-bearing cadences on first run", () => {
    const snap = evaluateCadence("quarterly", null, NOW);
    expect(statusMessage(snap)).toContain("load-bearing");
  });

  it("announces baseline for non-load-bearing cadences on first run", () => {
    const snap = evaluateCadence("monthly", null, NOW);
    expect(statusMessage(snap)).toContain("baseline");
  });

  it("includes ISO date for on_track cadences", () => {
    const recent = new Date(NOW.getTime() - 1 * DAY);
    const snap = evaluateCadence("weekly", recent, NOW);
    expect(statusMessage(snap)).toContain("On track");
    expect(statusMessage(snap)).toMatch(/Next cycle due \d{4}-\d{2}-\d{2}/);
  });

  it("emphasises load-bearing overdue cadences", () => {
    const stale = new Date(NOW.getTime() - 150 * DAY);
    const snap = evaluateCadence("quarterly", stale, NOW);
    expect(statusMessage(snap)).toContain("Overdue");
    expect(statusMessage(snap)).toContain("Load-bearing");
  });
});
