/**
 * Behavior-quadrant derivation — human-eval build plan Session 3.
 *
 * The four-quadrant model derives from three captured signals:
 *
 *   rationale_expanded:  did the user click to expand the rationale?
 *   time_to_action_ms:   elapsed ms from verdict surfaced to action
 *   override_stance:     agree | disagree | agree_but_overriding
 *
 * Combined into one of four quadrants that answer "how much signal is
 * in this override?":
 *
 *   pattern_match_accept — accepted within REFLEX_THRESHOLD_MS,
 *     rationale NOT expanded. The user recognized the pattern
 *     immediately and agreed. Low individual signal; useful in
 *     aggregate as a confidence booster for the rule.
 *
 *   informed_accept — rationale expanded, then agreed. Medium signal —
 *     the rationale moved the user from uncertain to confident.
 *
 *   informed_reject — rationale expanded, then disagreed (or shipped
 *     anyway). Highest-signal reject: the user read the reasoning and
 *     still pushed back. Primary feed for the taxonomy refinement log.
 *
 *   reflex_reject — rejected within REFLEX_THRESHOLD_MS without
 *     expanding. Lowest-signal reject: the user may have misread the
 *     finding. Worth sampling but not acting on individually.
 *
 * `unknown` is returned when inputs are too sparse to classify — e.g.,
 * pre-Session-3 rows with all three signals null.
 */

export type BehaviorQuadrant =
  | "pattern_match_accept"
  | "informed_accept"
  | "informed_reject"
  | "reflex_reject"
  | "unknown";

export type OverrideStance =
  | "agree"
  | "disagree"
  | "agree_but_overriding";

export const BEHAVIOR_QUADRANTS: readonly BehaviorQuadrant[] = [
  "pattern_match_accept",
  "informed_accept",
  "informed_reject",
  "reflex_reject",
  "unknown",
] as const;

/**
 * Reflex threshold in milliseconds. Below this, we treat the action as
 * a reflex (no meaningful reasoning time). 2000ms matches the plan
 * spec: "accepted within 2s, never expanded" → pattern_match; "rejected
 * within 2s without expanding" → reflex_reject.
 */
export const REFLEX_THRESHOLD_MS = 2000;

export interface BehaviorSignals {
  stance: OverrideStance | null | undefined;
  rationaleExpanded: boolean | null | undefined;
  timeToActionMs: number | null | undefined;
}

/**
 * Derive the behavior quadrant from captured signals. Pure function —
 * no side effects; same inputs always produce the same output.
 *
 * Decision table:
 *
 *   stance \ expanded  |  false (reflex)       |  true (informed)      |  null
 *   ─────────────────  |  ─────────────────    |  ─────────────────    |  ─────
 *   agree (fast)       |  pattern_match_accept |  informed_accept      |  unknown
 *   agree (slow)       |  informed_accept¹     |  informed_accept      |  unknown
 *   disagree           |  reflex_reject        |  informed_reject      |  unknown
 *   agree_but_override |  informed_reject²     |  informed_reject      |  unknown
 *
 *   ¹ Slow accept without expanding the rationale still implies the
 *     user reasoned about it — upgrade to informed_accept.
 *   ² "Agree but overriding" is treated as a reject for the behavior
 *     model: the user is shipping something the tool disagrees with,
 *     which is the same signal shape as a disagree.
 */
export function deriveBehaviorQuadrant(
  signals: BehaviorSignals,
): BehaviorQuadrant {
  const { stance, rationaleExpanded, timeToActionMs } = signals;

  if (stance == null) return "unknown";

  const isReject =
    stance === "disagree" || stance === "agree_but_overriding";

  // "Agree but overriding" always maps to informed_reject — the act of
  // overriding the tool's recommendation is itself an informed stance,
  // regardless of whether the rationale was expanded first.
  if (stance === "agree_but_overriding") return "informed_reject";

  if (rationaleExpanded === true) {
    return isReject ? "informed_reject" : "informed_accept";
  }

  const fast =
    typeof timeToActionMs === "number" &&
    timeToActionMs < REFLEX_THRESHOLD_MS;

  if (isReject) {
    return fast ? "reflex_reject" : "informed_reject";
  }

  if (fast) return "pattern_match_accept";

  // Slow accept without expansion — user reasoned about it even without
  // reading the rationale. Treat as informed.
  if (rationaleExpanded === false && typeof timeToActionMs === "number") {
    return "informed_accept";
  }

  // Lacking both expansion and timing signal — can't confidently place.
  return "unknown";
}

/**
 * Tally a list of signals into quadrant counts. Useful for the
 * dashboard rollup on `/dashboard/overrides`.
 */
export function summarizeQuadrants(
  rows: BehaviorSignals[],
): Record<BehaviorQuadrant, number> {
  const counts: Record<BehaviorQuadrant, number> = {
    pattern_match_accept: 0,
    informed_accept: 0,
    informed_reject: 0,
    reflex_reject: 0,
    unknown: 0,
  };
  for (const row of rows) {
    counts[deriveBehaviorQuadrant(row)] += 1;
  }
  return counts;
}

/**
 * Detect the `suggestion_rejected_alternative_applied` flag from the
 * counterfactual triple. Returns true only when all three hashes
 * differ — the user applied something that was neither the original
 * nor the tool's suggestion. Returns false when any hash is missing.
 */
export function isSuggestionRejectedAlternativeApplied(triple: {
  originalTextHash: string | null | undefined;
  suggestedTextHash: string | null | undefined;
  appliedTextHash: string | null | undefined;
}): boolean {
  const { originalTextHash, suggestedTextHash, appliedTextHash } = triple;
  if (!originalTextHash || !suggestedTextHash || !appliedTextHash) return false;
  return (
    appliedTextHash !== originalTextHash &&
    appliedTextHash !== suggestedTextHash
  );
}
