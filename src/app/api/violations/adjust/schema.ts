/**
 * Request schema for POST /api/violations/adjust.
 *
 * Extracted from route.ts so the validation rules can be unit-tested
 * without mounting the full route (which needs auth + DB + ratelimit
 * mocks). The route imports this and uses it as the parser for
 * incoming bodies.
 */

import { z } from "zod";

export const RequestSchema = z
  .object({
    // Same 100k cap as /api/check.
    text: z.string().min(1).max(100_000),
    signal_type: z.enum(["verdict", "suggestion", "both"]),
    // Verdict-path fields. Reuses the existing override-reason-code
    // vocabulary from src/lib/override-reasons.ts so the substrate
    // signal contract stays uniform.
    override_reason_code: z
      .enum([
        "not_applicable_here",
        "standard_too_strict",
        "fix_is_worse",
        "shipping_anyway",
        "confusing_need_more_context",
      ])
      .optional(),
    override_notes: z.string().min(1).max(500).optional(),
    // Suggestion-path field. Same length cap as `text` since it's a
    // proposed replacement for it.
    rewrite_text: z.string().min(1).max(100_000).optional(),
    // Common.
    issue: z.string().min(1).max(500).optional(),
    share_upstream: z.boolean().default(false),
  })
  .refine(
    (data) => {
      if (data.signal_type === "verdict" || data.signal_type === "both") {
        return data.override_reason_code !== undefined;
      }
      return true;
    },
    {
      message:
        "override_reason_code is required when signal_type is 'verdict' or 'both'",
      path: ["override_reason_code"],
    },
  )
  .refine(
    (data) => {
      if (data.signal_type === "suggestion" || data.signal_type === "both") {
        return data.rewrite_text !== undefined;
      }
      return true;
    },
    {
      message:
        "rewrite_text is required when signal_type is 'suggestion' or 'both'",
      path: ["rewrite_text"],
    },
  );

export type AdjustRequest = z.infer<typeof RequestSchema>;
