/**
 * Public API response envelope.
 *
 * Every public Next.js API route wraps its response with `envelope()`
 * so callers always see `schema_version` and `warnings` siblings on the
 * top-level response object. The semver policy lives in
 * `docs/API_VERSIONING.md`.
 *
 * Design choice — "lightweight envelope":
 *   We add `schema_version` and `warnings` to the existing top-level
 *   response shape rather than wrapping the previous payload inside a
 *   `result` key. That keeps every existing consumer (Figma plugin,
 *   CLI, MCP server, GitHub Action) working without code changes when
 *   we bump the version. The cost is non-uniform payloads across
 *   endpoints; the win is "old client still works after a minor bump,"
 *   which is the explicit Session 9 acceptance criterion.
 *
 *   New endpoints SHOULD put their primary data under `result` for
 *   consistency with the BUILD_PLAN_v2 envelope spec.
 */

// 1.0.0 — initial envelope (v2 Session 9)
// 1.1.0 — add `verdict`, per-Violation `confidence`, `review_reason`
//         on CheckResult (v2 Session 10). Additive.
// 1.2.0 — add `related_standards`, `ambiguity_flag`, `rule_version` on
//         Violation; add `rationale_chain` on CheckResult
//         (human-eval build plan Session 1). Additive.
// 1.3.0 — populate the remaining four typed `review_reason` subtypes:
//         standards_conflict, situation_ambiguity, out_of_distribution,
//         novel_pattern (human-eval build plan Session 2). Additive —
//         old clients reading `review_reason` as a raw string keep
//         working; clients that switch on the value should add arms.
// 1.4.0 — richer override signal on POST /api/violations/override:
//         override_stance, actor_role, rationale_expanded,
//         time_to_action_ms, suggested_text, applied_text (human-eval
//         build plan Session 3). Additive — pre-Session-3 clients
//         keep working without supplying any of the new fields.
export const SCHEMA_VERSION = "1.4.0" as const;

/**
 * Adds `schema_version` and `warnings` to a response payload. Existing
 * fields pass through unchanged.
 */
export function envelope<T extends Record<string, unknown>>(
  payload: T,
  opts: { warnings?: string[] } = {},
): T & { schema_version: string; warnings: string[] } {
  return {
    schema_version: SCHEMA_VERSION,
    warnings: opts.warnings ?? [],
    ...payload,
  };
}

/**
 * Type for an envelope-wrapped response. Use as the return type of any
 * public route handler so the contract is visible from the type system.
 */
export type ApiEnvelope<T extends Record<string, unknown>> = T & {
  schema_version: string;
  warnings: string[];
};
