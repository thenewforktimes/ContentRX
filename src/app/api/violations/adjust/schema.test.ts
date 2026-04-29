import { describe, expect, it } from "vitest";
import { RequestSchema } from "./schema";

/**
 * Pin the request-validation contract for /api/violations/adjust.
 *
 * The contract has two cross-field rules that aren't expressible
 * through plain field-level zod:
 *   - signal_type ∈ {verdict, both} requires override_reason_code
 *   - signal_type ∈ {suggestion, both} requires rewrite_text
 *
 * If a future refactor drops either refine, /admin queue starts
 * collecting malformed candidates with no recoverable substrate
 * intent. These tests catch that regression.
 */

describe("/api/violations/adjust — RequestSchema", () => {
  describe("verdict signal", () => {
    it("requires override_reason_code", () => {
      const result = RequestSchema.safeParse({
        text: "Click here",
        signal_type: "verdict",
        // override_reason_code intentionally omitted
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some(
            (i) => i.path.join(".") === "override_reason_code",
          ),
        ).toBe(true);
      }
    });

    it("accepts a verdict request with reason_code", () => {
      const result = RequestSchema.safeParse({
        text: "Click here",
        signal_type: "verdict",
        override_reason_code: "not_applicable_here",
      });
      expect(result.success).toBe(true);
    });

    it("does not require rewrite_text on verdict-only signal", () => {
      const result = RequestSchema.safeParse({
        text: "Click here",
        signal_type: "verdict",
        override_reason_code: "standard_too_strict",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("suggestion signal", () => {
    it("requires rewrite_text", () => {
      const result = RequestSchema.safeParse({
        text: "Click here",
        signal_type: "suggestion",
        // rewrite_text intentionally omitted
      });
      expect(result.success).toBe(false);
      if (!result.success) {
        expect(
          result.error.issues.some((i) => i.path.join(".") === "rewrite_text"),
        ).toBe(true);
      }
    });

    it("accepts a suggestion request with rewrite_text", () => {
      const result = RequestSchema.safeParse({
        text: "Click here",
        signal_type: "suggestion",
        rewrite_text: "View pricing",
      });
      expect(result.success).toBe(true);
    });

    it("does not require override_reason_code on suggestion-only signal", () => {
      const result = RequestSchema.safeParse({
        text: "Click here",
        signal_type: "suggestion",
        rewrite_text: "View pricing",
      });
      expect(result.success).toBe(true);
    });
  });

  describe("both signal", () => {
    it("requires both reason_code AND rewrite_text", () => {
      // Missing both
      const r1 = RequestSchema.safeParse({
        text: "Click here",
        signal_type: "both",
      });
      expect(r1.success).toBe(false);

      // Missing rewrite_text
      const r2 = RequestSchema.safeParse({
        text: "Click here",
        signal_type: "both",
        override_reason_code: "not_applicable_here",
      });
      expect(r2.success).toBe(false);

      // Missing reason_code
      const r3 = RequestSchema.safeParse({
        text: "Click here",
        signal_type: "both",
        rewrite_text: "View pricing",
      });
      expect(r3.success).toBe(false);

      // Both present → valid
      const r4 = RequestSchema.safeParse({
        text: "Click here",
        signal_type: "both",
        override_reason_code: "not_applicable_here",
        rewrite_text: "View pricing",
      });
      expect(r4.success).toBe(true);
    });
  });

  describe("share_upstream default", () => {
    it("defaults share_upstream to FALSE per ADR 2026-04-28", () => {
      // Privacy-by-default. The customer must explicitly opt in to
      // share their adjustment with the upstream model. A future
      // refactor that flips this default would silently leak
      // customer rewrites into Robert's triage queue.
      const result = RequestSchema.safeParse({
        text: "Click here",
        signal_type: "verdict",
        override_reason_code: "not_applicable_here",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.share_upstream).toBe(false);
      }
    });

    it("accepts share_upstream=true when the customer explicitly opts in", () => {
      const result = RequestSchema.safeParse({
        text: "Click here",
        signal_type: "suggestion",
        rewrite_text: "View pricing",
        share_upstream: true,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.share_upstream).toBe(true);
      }
    });
  });

  describe("size + text limits", () => {
    it("rejects empty text", () => {
      const result = RequestSchema.safeParse({
        text: "",
        signal_type: "verdict",
        override_reason_code: "not_applicable_here",
      });
      expect(result.success).toBe(false);
    });

    it("rejects text over the 100k cap", () => {
      const result = RequestSchema.safeParse({
        text: "x".repeat(100_001),
        signal_type: "verdict",
        override_reason_code: "not_applicable_here",
      });
      expect(result.success).toBe(false);
    });

    it("rejects override_notes over the 500-char cap", () => {
      const result = RequestSchema.safeParse({
        text: "Click here",
        signal_type: "verdict",
        override_reason_code: "not_applicable_here",
        override_notes: "x".repeat(501),
      });
      expect(result.success).toBe(false);
    });
  });

  describe("override_reason_code vocabulary", () => {
    it("accepts all 5 codes from override-reasons.ts", () => {
      const codes = [
        "not_applicable_here",
        "standard_too_strict",
        "fix_is_worse",
        "shipping_anyway",
        "confusing_need_more_context",
      ] as const;
      for (const code of codes) {
        const result = RequestSchema.safeParse({
          text: "Click here",
          signal_type: "verdict",
          override_reason_code: code,
        });
        expect(result.success).toBe(true);
      }
    });

    it("rejects unknown reason codes", () => {
      const result = RequestSchema.safeParse({
        text: "Click here",
        signal_type: "verdict",
        override_reason_code: "made_up_code",
      });
      expect(result.success).toBe(false);
    });
  });
});
