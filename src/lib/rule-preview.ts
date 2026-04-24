/**
 * Rule dry-run preview — BUILD_PLAN_v2 Session 12.
 *
 * Before a team owner commits a rule change (disable / override / add),
 * replay the change over the last N days of team history and show
 * the diff. Prevents footguns — "I disabled CLR-01 and 847 historical
 * violations vanished" is a useful thing to see before clicking save.
 *
 * Approach:
 *
 * - `disable` — we scan the team's logged violations in the window
 *   and count rows whose standard_id matches the proposed rule.
 *   Those rows would no longer surface. `would_remove_violations`
 *   is exact.
 *
 * - `override` — cosmetic-only per the existing team-rules pipeline
 *   (changes rule text / severity / title; doesn't filter or fire
 *   new violations). We surface a sample of rows whose display
 *   would change and report `would_remove_violations: 0`.
 *
 * - `add` — the custom rule fires a regex against the raw input
 *   text. Historical text isn't stored (only sha256(text)), so we
 *   genuinely cannot replay against it. `would_add_violations:
 *   null` with a `note` explaining the limitation. Honest over
 *   misleading.
 *
 * This module is pure logic — route passes already-fetched rows in.
 */

export type RuleAction = "disable" | "override" | "add";

export interface ProposedRuleChange {
  action: RuleAction;
  standard_id: string;
  // action === "override" only reads `override`; the shape mirrors
  // team_rules.rule_json on that action.
  override?: {
    severity?: string;
    rule?: string;
    title?: string;
  };
}

export interface HistoricalViolationRow {
  id: string;
  standardId: string;
  severity: string;
  moment: string | null;
  contentType: string;
  textHash: string;
  createdAt: Date | string;
}

export interface RulePreviewInput {
  change: ProposedRuleChange;
  violations: readonly HistoricalViolationRow[];
  sampleCap?: number;
}

export type PreviewSample = {
  id: string;
  standard_id: string;
  severity: string;
  moment: string | null;
  content_type: string;
  text_hash: string;
  created_at: string;
};

export interface RulePreviewResult {
  schema_version: "1.0.0";
  result: {
    action: RuleAction;
    standard_id: string;
    window_violations: number;
    would_remove_violations: number;
    would_add_violations: number | null;
    would_convert_to_review: number;
    sample_before: PreviewSample[];
    sample_after: PreviewSample[];
    note: string | null;
  };
}

export const DEFAULT_SAMPLE_CAP = 10;
// "Review" severity bucket — overrides that lower a standard to
// this string effectively convert violations into review-recommended.
// Kept as an allow-list so typos in rule_json don't silently drop
// violations into nothing.
const REVIEW_SEVERITIES: ReadonlySet<string> = new Set([
  "review",
  "review_recommended",
]);

/**
 * Compute the preview diff for a proposed rule change.
 *
 * Never throws — unknown actions return a zero-impact result with
 * an explanatory note rather than crashing the UI.
 */
export function buildRulePreview(
  input: RulePreviewInput,
): RulePreviewResult {
  const cap = input.sampleCap ?? DEFAULT_SAMPLE_CAP;
  const change = input.change;

  // Matching rows — these are the violations in the window that
  // the proposed rule would act on.
  const matching = input.violations.filter(
    (v) => v.standardId === change.standard_id,
  );
  const sample = dedupeBy(matching, (v) => v.textHash).slice(0, cap);

  if (change.action === "disable") {
    return envelope(change, input.violations.length, {
      would_remove_violations: matching.length,
      would_add_violations: 0,
      would_convert_to_review: 0,
      sample_before: sample.map(toSample),
      sample_after: [], // filtered away entirely
      note:
        matching.length === 0
          ? `No historical violations for ${change.standard_id} in this window — disabling is safe but has no visible impact yet.`
          : null,
    });
  }

  if (change.action === "override") {
    const targetSeverity = change.override?.severity;
    const convertsToReview =
      targetSeverity && REVIEW_SEVERITIES.has(targetSeverity)
        ? matching.length
        : 0;
    const sampleAfter = sample.map((v) => {
      const out = toSample(v);
      return {
        ...out,
        severity: targetSeverity ?? out.severity,
      };
    });
    return envelope(change, input.violations.length, {
      would_remove_violations: 0,
      would_add_violations: 0,
      would_convert_to_review: convertsToReview,
      sample_before: sample.map(toSample),
      sample_after: sampleAfter,
      note:
        "Overrides change how violations are presented (rule text, severity, title). They don't filter or create new violations — the engine still fires the same standards.",
    });
  }

  if (change.action === "add") {
    return envelope(change, input.violations.length, {
      would_remove_violations: 0,
      would_add_violations: null,
      would_convert_to_review: 0,
      sample_before: [],
      sample_after: [],
      note:
        "Add-rules fire a regex against the raw input text. We store only sha256(text), so historical impact can't be computed. Save the rule to see it fire on new evaluations.",
    });
  }

  // Unknown action — fail soft.
  return envelope(change, input.violations.length, {
    would_remove_violations: 0,
    would_add_violations: 0,
    would_convert_to_review: 0,
    sample_before: [],
    sample_after: [],
    note: `Unknown rule action: ${change.action}`,
  });
}

function envelope(
  change: ProposedRuleChange,
  windowCount: number,
  body: Omit<
    RulePreviewResult["result"],
    "action" | "standard_id" | "window_violations"
  >,
): RulePreviewResult {
  return {
    schema_version: "1.0.0",
    result: {
      action: change.action,
      standard_id: change.standard_id,
      window_violations: windowCount,
      ...body,
    },
  };
}

function toSample(row: HistoricalViolationRow): PreviewSample {
  return {
    id: row.id,
    standard_id: row.standardId,
    severity: row.severity,
    moment: row.moment,
    content_type: row.contentType,
    text_hash: row.textHash,
    created_at:
      row.createdAt instanceof Date
        ? row.createdAt.toISOString()
        : String(row.createdAt),
  };
}

function dedupeBy<T>(rows: readonly T[], key: (r: T) => string): T[] {
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of rows) {
    const k = key(r);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(r);
  }
  return out;
}
