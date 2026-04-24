# Quarterly review — {YYYY-Qn}

**Reviewer:** {name}
**Completed:** {YYYY-MM-DD}
**Source artifact:** `evals/drift/reports/{YYYY-Qn}.json`

This is the **load-bearing** cadence. Graduation thresholds
(Session 10) depend on the measured ceiling computed here. Skipping
a quarter leaves the threshold mis-calibrated — run it.

## 1. Drift-check summary

Produced by `tools/drift_check.py`. See
`/dashboard/cadence/quarterly` for the rendered view.

- Measured self-drift κ: {value} (95% CI: {lo}–{hi})
- Sample size: n={n}
- Regime: {stable / watch / material_drift}
- Autonomous κ threshold (recalibrated): {value}
- Batch-approval κ threshold (recalibrated): {value}
- Regime blocks new autonomous graduations? {yes / no}

## 2. Standards triggering self-disagreement

Any standard in the drift report's `implicated_standards` list.

| standard_id | disagreements | pattern |
|---|---|---|
| {std} | {n} | {notes on what changed} |

For each: does the divergence indicate taxonomy drift that requires
a refinement-log entry, or is it a one-off?

## 3. Graduation candidates this quarter

Source: `tools/graduation_metrics.py` against the recalibrated
thresholds.

- Promoted to autonomous: {standards or "none"}
- Promoted to batch-approval: {standards or "none"}
- Demoted: {standards or "none"}
- Still in progress: {count}

## 4. Retirement candidates

Source: `tools/refinement_candidate_detector.py` (auto-detected) +
manual review.

- {standard_id}: {retirement rationale, fire rate, override rate}

## 5. Preference-pool check (Session 31)

If the preference pool is live:

- Aligned responses this quarter: {n}
- Contested tuples newly surfaced: {list}

## 6. Follow-ups for next quarter

- [ ] Update threshold constants in code if regime shifted
- [ ] File refinement-log entries for standards needing work
- [ ] Re-run `suggestion_preference_report.py` once the preference pool grew

## 7. Notes

{freeform}
