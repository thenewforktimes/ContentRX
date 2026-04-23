import { describe, it, expect } from "vitest";
import { QUOTAS, currentMonth, monthlyQuota } from "./quotas";

describe("quotas", () => {
  describe("monthlyQuota", () => {
    it("free plan returns the free quota regardless of seats", () => {
      expect(monthlyQuota("free")).toBe(QUOTAS.free);
      expect(monthlyQuota("free", 5)).toBe(QUOTAS.free);
    });

    it("pro plan returns the pro quota regardless of seats", () => {
      expect(monthlyQuota("pro")).toBe(QUOTAS.pro);
      expect(monthlyQuota("pro", 10)).toBe(QUOTAS.pro);
    });

    it("team plan scales by seat count", () => {
      expect(monthlyQuota("team", 1)).toBe(QUOTAS.team * 1);
      expect(monthlyQuota("team", 3)).toBe(QUOTAS.team * 3);
      expect(monthlyQuota("team", 10)).toBe(QUOTAS.team * 10);
    });

    it("team plan floors seats to 1", () => {
      expect(monthlyQuota("team", 0)).toBe(QUOTAS.team);
      expect(monthlyQuota("team", -5)).toBe(QUOTAS.team);
    });
  });

  describe("currentMonth", () => {
    it("formats YYYY-MM with zero-padded month", () => {
      expect(currentMonth(new Date(Date.UTC(2026, 0, 15)))).toBe("2026-01");
      expect(currentMonth(new Date(Date.UTC(2026, 8, 15)))).toBe("2026-09");
      expect(currentMonth(new Date(Date.UTC(2026, 11, 15)))).toBe("2026-12");
    });

    it("uses UTC so boundary days don't flip based on local timezone", () => {
      // First moment of Feb 1, 2026 UTC — in any timezone west of UTC this
      // would be Jan 31 local. currentMonth must report February.
      const firstOfFeb = new Date(Date.UTC(2026, 1, 1, 0, 0, 0));
      expect(currentMonth(firstOfFeb)).toBe("2026-02");
    });
  });
});
