"""Graduation-criteria readiness computer — human-eval build plan Session 10.

Codifies the six criteria that govern when a standard promotes up the
ladder from `robo_labels` → `batch_approval` → `autonomous`. All six
are AND-ed — a standard with 0.95 κ and 60% counterpart pass rate
does NOT graduate. Averaging hides the shortcut-learning failure mode
precisely where it's most dangerous.

The six criteria:

    1. Sample size    ≥500 agreements (autonomous) / ≥200 (batch).
                      100–200 → tighten required κ by +0.02.
                      <100 → graduation blocked regardless of κ.

    2. Cohen's κ      ≥ 0.94 × measured_ceiling (autonomous) /
                      ≥ 0.83 × measured_ceiling (batch-approval).
                      Measured ceiling comes from Session 7's drift
                      report; thresholds auto-recalibrate when it moves.

    3. Raw agreement  ≥ 80% (autonomous) / ≥ 70% (batch). McHugh 2012
                      floor — guards against κ inflation on skewed
                      marginals.

    4. MCC supplement When observed positive-class prevalence <15%,
                      κ is unreliable (Chicco/Warrens/Jurman 2021).
                      Add MCC ≥ 0.70 (autonomous) / ≥ 0.60 (batch).
                      Kappa stays default; MCC is a supplement.

    5. Override rate  <5% (autonomous) / <10% (batch). Production
                      override events from Session 4, weighted by
                      actor_role (content-designer > engineer > other).

    6. Counterparts   Novel-case "pass" cases for the standard must
                      meet a tier-based minimum count (5/8/12 by
                      prevalence band; +3 for structurally complex
                      rules), span ≥2 of 3 variation axes with
                      within-moment mandatory, and pass at ≥80%.

Stability window: 4 weeks. Every one of the prior 4 weekly κ values
must meet the threshold — not just the average. A standard that just
crossed the line doesn't graduate; we wait for stability.

Rule-version policy (counterpart credit on rule-text changes):
    - Semantic change    : full counterpart reset.
    - Wording-only change: prior counterparts carry at 50% weight.
    - Additive carve-out : counterparts outside the carve-out carry
                           at full weight; those inside need re-verification.

Usage:
    python3 tools/graduation_metrics.py compute \\
        --reviews       reviews_last_4_weeks.json \\
        --overrides     overrides_last_4_weeks.json \\
        --industry      evals/industry \\
        --novel         evals/novel_cases.json \\
        --drift-report  evals/drift/reports/2026-q2.json \\
        --out           evals/graduation/readiness.json

    python3 tools/graduation_metrics.py explain --standard CLR-01 \\
        --readiness evals/graduation/readiness.json
"""

from __future__ import annotations

import argparse
import collections
import datetime as _dt
import json
import math
import sys
from pathlib import Path
from typing import Any, Iterable


# ---------------------------------------------------------------------------
# Graduation levels
# ---------------------------------------------------------------------------

LEVEL_ROBO_LABELS = "robo_labels"
LEVEL_BATCH_APPROVAL = "batch_approval"
LEVEL_AUTONOMOUS = "autonomous"

LEVELS_ASC = (LEVEL_ROBO_LABELS, LEVEL_BATCH_APPROVAL, LEVEL_AUTONOMOUS)


# ---------------------------------------------------------------------------
# Thresholds (plan-spec constants)
# ---------------------------------------------------------------------------

SAMPLE_SIZE_AUTONOMOUS = 500
SAMPLE_SIZE_BATCH_APPROVAL = 200
SAMPLE_SIZE_FLOOR = 100
SAMPLE_TIGHTEN_LOWER = 100
SAMPLE_TIGHTEN_UPPER = 200
SAMPLE_TIGHTEN_KAPPA_DELTA = 0.02

# Session 7 exposes the ratio constants; re-import here would create a
# circular-style dependency, so inline-mirror them with a comment.
AUTONOMOUS_KAPPA_RATIO = 0.94    # mirrors tools/drift_check.py AUTONOMOUS_RATIO
BATCH_APPROVAL_KAPPA_RATIO = 0.83  # mirrors BATCH_APPROVAL_RATIO

RAW_AGREEMENT_AUTONOMOUS = 0.80
RAW_AGREEMENT_BATCH_APPROVAL = 0.70

MCC_AUTONOMOUS = 0.70
MCC_BATCH_APPROVAL = 0.60
MCC_PREVALENCE_THRESHOLD = 0.15

OVERRIDE_RATE_AUTONOMOUS = 0.05
OVERRIDE_RATE_BATCH_APPROVAL = 0.10

# actor_role weighting for the override rate (Session 4 helpers).
# Content-designer overrides carry more weight than engineer overrides
# on content-design questions; missing/unknown roles weight 1.0.
ACTOR_ROLE_WEIGHTS: dict[str, float] = {
    "designer": 1.5,
    "pm": 1.0,
    "engineer": 0.75,
    "other": 1.0,
    None: 1.0,  # type: ignore[dict-item]
}

COUNTERPART_PASS_RATE = 0.80
COUNTERPART_TIER_LOW = 5      # prevalence <15%
COUNTERPART_TIER_MID = 8      # 15–40%
COUNTERPART_TIER_HIGH = 12    # >40%
COUNTERPART_STRUCTURAL_BONUS = 3

COUNTERPART_WITHIN_MOMENT_TARGET = 0.60
COUNTERPART_CROSS_CONTENT_TYPE_TARGET = 0.25
COUNTERPART_CROSS_MOMENT_TARGET = 0.15

STABILITY_WINDOW_WEEKS = 4


# ---------------------------------------------------------------------------
# Statistics primitives
# ---------------------------------------------------------------------------


def compute_kappa(pairs: list[tuple[str, str]]) -> float | None:
    """Cohen's κ on binary rater pairs. Same contract as
    `tools/drift_check.py.cohens_kappa`; duplicated locally to avoid a
    cross-tool import since the tools directory isn't a package."""
    if len(pairs) < 2:
        return None
    n = len(pairs)
    po = sum(1 for a, b in pairs if a == b) / n
    counts_a = collections.Counter(a for a, _ in pairs)
    counts_b = collections.Counter(b for _, b in pairs)
    labels = set(counts_a) | set(counts_b)
    pe = sum(
        (counts_a.get(lbl, 0) / n) * (counts_b.get(lbl, 0) / n) for lbl in labels
    )
    if pe >= 1.0:
        return None
    return (po - pe) / (1.0 - pe)


def compute_raw_agreement(pairs: list[tuple[str, str]]) -> float | None:
    """Plain proportion of agreement — McHugh's recommended floor."""
    if not pairs:
        return None
    return sum(1 for a, b in pairs if a == b) / len(pairs)


def compute_mcc(
    pairs: list[tuple[str, str]],
    positive_label: str = "fail",
) -> float | None:
    """Matthews Correlation Coefficient on binary pairs. Required
    supplement for low-prevalence standards per Chicco et al. 2021.

    The positive class is `fail` by default — the machine-flagging
    direction. Treat `pass` as negative.
    """
    if not pairs:
        return None
    tp = tn = fp = fn = 0
    for human, machine in pairs:
        is_pos_h = human == positive_label
        is_pos_m = machine == positive_label
        if is_pos_h and is_pos_m:
            tp += 1
        elif not is_pos_h and not is_pos_m:
            tn += 1
        elif is_pos_h and not is_pos_m:
            fn += 1
        else:
            fp += 1
    denom_sq = (tp + fp) * (tp + fn) * (tn + fp) * (tn + fn)
    if denom_sq == 0:
        return None  # undefined when any marginal is zero
    return (tp * tn - fp * fn) / math.sqrt(denom_sq)


def compute_prevalence(
    cases: Iterable[dict[str, Any]],
    *,
    positive_label: str = "fail",
    verdict_field: str = "human_verdict",
) -> float | None:
    """Observed positive-class prevalence across a case pool."""
    total = 0
    pos = 0
    for c in cases:
        v = c.get(verdict_field)
        if v not in ("pass", "fail"):
            continue
        total += 1
        if v == positive_label:
            pos += 1
    if total == 0:
        return None
    return pos / total


# ---------------------------------------------------------------------------
# Counterpart checks
# ---------------------------------------------------------------------------


def counterpart_tier(
    prevalence: float,
    *,
    structurally_complex: bool = False,
) -> int:
    """Minimum counterpart count by prevalence band.

    Prevalence <15%  → 5
    Prevalence 15–40% → 8
    Prevalence >40%  → 12
    Structurally complex (multi-conjunct / moment-referencing) adds +3.
    """
    if prevalence < 0.15:
        base = COUNTERPART_TIER_LOW
    elif prevalence <= 0.40:
        base = COUNTERPART_TIER_MID
    else:
        base = COUNTERPART_TIER_HIGH
    if structurally_complex:
        base += COUNTERPART_STRUCTURAL_BONUS
    return base


def counterpart_variation(
    counterparts: list[dict[str, Any]],
    *,
    primary_moment: str | None,
    primary_content_type: str | None,
) -> dict[str, Any]:
    """Classify each counterpart into a variation axis and check the
    plan-spec thresholds.

    Axes:
        within_moment_within_type : same moment + same content_type as
                                    the standard's primary axis; must
                                    be ≥60% of counterparts.
        cross_content_type        : same moment, different content_type;
                                    target ≥25%.
        cross_moment              : different moment; target ≥15%.

    Returns counts, percentages, a bool for "at least 2 of 3 axes with
    within-moment mandatory", and a list of violations (when <60% of
    counterparts land in the within-moment-within-type bucket, etc.).
    """
    n = len(counterparts)
    if n == 0:
        return {
            "counts": {"within_moment_within_type": 0,
                       "cross_content_type": 0,
                       "cross_moment": 0},
            "percentages": {},
            "axes_represented": 0,
            "within_moment_mandatory": False,
            "passes": False,
            "violations": ["no counterparts provided"],
        }

    within_type = cross_ct = cross_moment = 0
    for cp in counterparts:
        cp_moment = cp.get("moment")
        cp_type = cp.get("content_type")
        if primary_moment and cp_moment and cp_moment != primary_moment:
            cross_moment += 1
        elif primary_content_type and cp_type and cp_type != primary_content_type:
            cross_ct += 1
        else:
            within_type += 1

    pct = {
        "within_moment_within_type": within_type / n,
        "cross_content_type": cross_ct / n,
        "cross_moment": cross_moment / n,
    }
    axes_represented = sum(
        1 for v in (within_type, cross_ct, cross_moment) if v > 0
    )
    within_moment_mandatory = within_type > 0

    violations: list[str] = []
    if not within_moment_mandatory:
        violations.append(
            "within-moment axis empty (mandatory)"
        )
    if pct["within_moment_within_type"] < COUNTERPART_WITHIN_MOMENT_TARGET:
        violations.append(
            f"within-moment share {pct['within_moment_within_type']:.0%}"
            f" < target {COUNTERPART_WITHIN_MOMENT_TARGET:.0%}"
        )
    if axes_represented < 2:
        violations.append(
            f"only {axes_represented} variation axes represented (need ≥2)"
        )

    return {
        "counts": {
            "within_moment_within_type": within_type,
            "cross_content_type": cross_ct,
            "cross_moment": cross_moment,
        },
        "percentages": pct,
        "axes_represented": axes_represented,
        "within_moment_mandatory": within_moment_mandatory,
        "passes": not violations,
        "violations": violations,
    }


def counterpart_pass_rate(
    counterparts: list[dict[str, Any]],
    engine_verdicts: dict[str, str],
) -> float | None:
    """Fraction of counterpart cases the engine correctly passes.

    `engine_verdicts` maps case_id → engine's verdict on that counterpart.
    A counterpart is a case where the standard should NOT fire
    (expected=pass), so the engine should return `pass` to get credit.
    """
    n = len(counterparts)
    if n == 0:
        return None
    correct = 0
    for cp in counterparts:
        cid = cp.get("case_id")
        engine = engine_verdicts.get(cid or "")
        if engine == "pass":
            correct += 1
    return correct / n


# ---------------------------------------------------------------------------
# Rule-version credit policy
# ---------------------------------------------------------------------------

RULE_VERSION_SEMANTIC = "semantic"
RULE_VERSION_WORDING = "wording"
RULE_VERSION_ADDITIVE = "additive"


def apply_rule_version_credit(
    counterparts: list[dict[str, Any]],
    *,
    change_kind: str | None,
    change_affects: set[str] | None = None,
) -> tuple[list[dict[str, Any]], float]:
    """Apply the rule-version-change policy to a counterpart set.

    Returns (effective_counterparts, weight_multiplier).

    - Semantic change: counterparts return empty, weight 0.0.
    - Wording-only change: counterparts pass through, weight 0.5.
    - Additive carve-out: counterparts outside `change_affects` pass
      at weight 1.0; those inside are dropped.
    - None (no change): full credit.
    """
    if change_kind is None:
        return counterparts, 1.0
    if change_kind == RULE_VERSION_SEMANTIC:
        return [], 0.0
    if change_kind == RULE_VERSION_WORDING:
        return counterparts, 0.5
    if change_kind == RULE_VERSION_ADDITIVE:
        affects = change_affects or set()
        kept = [
            c for c in counterparts
            if str(c.get("case_id", "")) not in affects
        ]
        return kept, 1.0
    # Unknown change kind — conservative: full reset.
    return [], 0.0


# ---------------------------------------------------------------------------
# Stability window
# ---------------------------------------------------------------------------


def bucket_reviews_by_week(
    reviews: list[dict[str, Any]],
    *,
    end_date: _dt.date,
    weeks: int = STABILITY_WINDOW_WEEKS,
) -> list[list[dict[str, Any]]]:
    """Group review events into the prior `weeks` weekly buckets.

    Index 0 is the oldest week, index `weeks-1` is the week ending
    on `end_date`. Each bucket is a list of review events.
    """
    day_ms = 24 * 60 * 60 * 1000
    end_ts = _dt.datetime.combine(
        end_date, _dt.time.max, tzinfo=_dt.timezone.utc
    ).timestamp() * 1000
    start_ts = end_ts - weeks * 7 * day_ms

    buckets: list[list[dict[str, Any]]] = [[] for _ in range(weeks)]
    for r in reviews:
        ts_raw = r.get("timestamp") or r.get("created_at")
        if ts_raw is None:
            continue
        if isinstance(ts_raw, (int, float)):
            ts = float(ts_raw)
        else:
            try:
                ts = _dt.datetime.fromisoformat(
                    str(ts_raw).replace("Z", "+00:00"),
                ).timestamp() * 1000
            except ValueError:
                continue
        if ts < start_ts or ts > end_ts:
            continue
        offset = int((ts - start_ts) // (7 * day_ms))
        if 0 <= offset < weeks:
            buckets[offset].append(r)
    return buckets


def stable_above(
    weekly_metric: list[float | None],
    threshold: float,
) -> bool:
    """Every week's metric must be non-None AND ≥ threshold."""
    if len(weekly_metric) == 0:
        return False
    return all(v is not None and v >= threshold for v in weekly_metric)


# ---------------------------------------------------------------------------
# Assessment — one standard at a time
# ---------------------------------------------------------------------------


def _pairs_from_reviews(reviews: list[dict[str, Any]]) -> list[tuple[str, str]]:
    """(human_verdict, machine_verdict) pairs from review events."""
    pairs: list[tuple[str, str]] = []
    for r in reviews:
        h = r.get("human_verdict")
        m = r.get("machine_verdict")
        if h in ("pass", "fail") and m in ("pass", "fail"):
            pairs.append((h, m))
    return pairs


def _weighted_override_rate(
    overrides: list[dict[str, Any]],
    total_verdicts: int,
) -> float | None:
    """Override rate weighted by actor_role. `total_verdicts` is the
    denominator — total verdicts the standard produced in the window.
    """
    if total_verdicts <= 0:
        return None
    weight = 0.0
    for o in overrides:
        role = o.get("actor_role")
        weight += ACTOR_ROLE_WEIGHTS.get(role, 1.0)
    return weight / total_verdicts


def compute_ensemble_disagreement_rate(
    events: list[dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    """Per-standard scan/validate disagreement rate (Session 13).

    Tracked alongside the six graduation criteria but NOT a hard gate
    — the spec is explicit: "tracked as an additional graduation-
    readiness signal." A high rate flags a standard whose
    content_type_notes or examples may need work.

    Input: a list of pipeline-event records, each of shape
        {standard_id: str, scan_proposed: bool, validate_rejected: bool}

    Output: standard_id → {
        "scan_proposals": int,
        "validate_rejections": int,
        "disagreement_rate": float | None,  # rejections / proposals
    }

    When events is empty or no standard has proposals in the window,
    returns an empty dict — consumers display "n/a" rather than a
    misleading 0.
    """
    by_standard: dict[str, dict[str, int]] = collections.defaultdict(
        lambda: {"scan_proposals": 0, "validate_rejections": 0}
    )
    for ev in events:
        sid = ev.get("standard_id")
        if not sid:
            continue
        if ev.get("scan_proposed"):
            by_standard[sid]["scan_proposals"] += 1
        if ev.get("validate_rejected"):
            by_standard[sid]["validate_rejections"] += 1

    out: dict[str, dict[str, Any]] = {}
    for sid, counts in by_standard.items():
        proposals = counts["scan_proposals"]
        rate: float | None = None
        if proposals > 0:
            rate = counts["validate_rejections"] / proposals
        out[sid] = {
            "scan_proposals": proposals,
            "validate_rejections": counts["validate_rejections"],
            "disagreement_rate": rate,
        }
    return out


def assess_standard(
    standard_id: str,
    *,
    reviews: list[dict[str, Any]],
    overrides: list[dict[str, Any]],
    total_verdicts: int,
    novel_counterparts: list[dict[str, Any]],
    counterpart_engine_verdicts: dict[str, str],
    prevalence: float | None,
    structurally_complex: bool = False,
    measured_ceiling: float = 0.90,
    end_date: _dt.date | None = None,
    primary_moment: str | None = None,
    primary_content_type: str | None = None,
    rule_version_change: str | None = None,
    rule_version_change_affects: set[str] | None = None,
    ensemble_disagreement: dict[str, Any] | None = None,
) -> dict[str, Any]:
    """Compute all 6 criteria for one standard and emit a readiness
    record.

    `reviews`       — agree/override events over the 4-week window
                      (oldest-first or mixed; bucketed internally).
    `overrides`     — production override events in the same window.
    `total_verdicts` — denominator for the override rate.
    `novel_counterparts` — pass-cases for the standard from novel corpus.
    `counterpart_engine_verdicts` — map case_id → engine's verdict for
                                    pass-rate computation.
    `prevalence`    — observed positive-class prevalence on the
                      industry corpus (for MCC supplementation + tier).
    """
    end = end_date or _dt.date.today()

    # --- Rule-version counterpart credit policy (applied BEFORE tier) ---
    effective_counterparts, cp_weight = apply_rule_version_credit(
        novel_counterparts,
        change_kind=rule_version_change,
        change_affects=rule_version_change_affects,
    )

    # --- 1. Sample size + tightening modifier ---
    pairs = _pairs_from_reviews(reviews)
    sample_n = len(pairs)

    # --- 2. Kappa + stability window ---
    raw_kappa = compute_kappa(pairs)
    weekly_buckets = bucket_reviews_by_week(reviews, end_date=end)
    weekly_kappa: list[float | None] = [
        compute_kappa(_pairs_from_reviews(b)) for b in weekly_buckets
    ]

    # Effective κ thresholds include the sample-size tightening.
    tighten_delta = (
        SAMPLE_TIGHTEN_KAPPA_DELTA
        if SAMPLE_TIGHTEN_LOWER <= sample_n < SAMPLE_TIGHTEN_UPPER
        else 0.0
    )
    autonomous_kappa_threshold = (
        AUTONOMOUS_KAPPA_RATIO * measured_ceiling + tighten_delta
    )
    batch_kappa_threshold = (
        BATCH_APPROVAL_KAPPA_RATIO * measured_ceiling + tighten_delta
    )

    # --- 3. Raw agreement ---
    raw_agreement = compute_raw_agreement(pairs)

    # --- 4. MCC supplementation for low-prevalence standards ---
    needs_mcc = prevalence is not None and prevalence < MCC_PREVALENCE_THRESHOLD
    mcc = compute_mcc(pairs) if needs_mcc else None

    # --- 5. Override rate (actor-weighted) ---
    override_rate = _weighted_override_rate(overrides, total_verdicts)

    # --- 6. Counterpart tier + variation + pass rate ---
    tier_minimum = counterpart_tier(
        prevalence or 0.0, structurally_complex=structurally_complex,
    )
    # Effective count uses the rule-version weight multiplier.
    effective_count = int(round(len(effective_counterparts) * cp_weight))
    cp_variation = counterpart_variation(
        effective_counterparts,
        primary_moment=primary_moment,
        primary_content_type=primary_content_type,
    )
    cp_pass_rate = counterpart_pass_rate(
        effective_counterparts, counterpart_engine_verdicts,
    )

    # --- Per-criterion pass/fail at each level ---
    def criterion_results(level: str) -> dict[str, Any]:
        is_auto = level == LEVEL_AUTONOMOUS
        sample_req = SAMPLE_SIZE_AUTONOMOUS if is_auto else SAMPLE_SIZE_BATCH_APPROVAL
        kappa_thr = autonomous_kappa_threshold if is_auto else batch_kappa_threshold
        raw_thr = RAW_AGREEMENT_AUTONOMOUS if is_auto else RAW_AGREEMENT_BATCH_APPROVAL
        mcc_thr = MCC_AUTONOMOUS if is_auto else MCC_BATCH_APPROVAL
        or_thr = OVERRIDE_RATE_AUTONOMOUS if is_auto else OVERRIDE_RATE_BATCH_APPROVAL

        sample_pass = sample_n >= sample_req
        sample_floor_pass = sample_n >= SAMPLE_SIZE_FLOOR
        kappa_pass = (
            raw_kappa is not None
            and raw_kappa >= kappa_thr
            and stable_above(weekly_kappa, kappa_thr)
        )
        raw_pass = raw_agreement is not None and raw_agreement >= raw_thr
        mcc_pass = (
            not needs_mcc
            or (mcc is not None and mcc >= mcc_thr)
        )
        override_pass = (
            override_rate is not None and override_rate < or_thr
        )
        cp_count_pass = effective_count >= tier_minimum
        cp_variation_pass = cp_variation["passes"]
        cp_rate_pass = (
            cp_pass_rate is not None and cp_pass_rate >= COUNTERPART_PASS_RATE
        )
        counterpart_pass = cp_count_pass and cp_variation_pass and cp_rate_pass

        all_pass = (
            sample_pass
            and sample_floor_pass
            and kappa_pass
            and raw_pass
            and mcc_pass
            and override_pass
            and counterpart_pass
        )
        return {
            "eligible": all_pass,
            "criteria": {
                "sample_size": {
                    "value": sample_n, "threshold": sample_req, "pass": sample_pass,
                    "floor_pass": sample_floor_pass,
                    "tighten_applied": tighten_delta > 0,
                },
                "kappa": {
                    "value": raw_kappa,
                    "threshold": kappa_thr,
                    "weekly": weekly_kappa,
                    "stable_above": stable_above(weekly_kappa, kappa_thr),
                    "pass": kappa_pass,
                },
                "raw_agreement": {
                    "value": raw_agreement, "threshold": raw_thr,
                    "pass": raw_pass,
                },
                "mcc": {
                    "needed": needs_mcc,
                    "value": mcc,
                    "threshold": mcc_thr if needs_mcc else None,
                    "pass": mcc_pass,
                },
                "override_rate": {
                    "value": override_rate, "threshold": or_thr,
                    "pass": override_pass,
                },
                "counterparts": {
                    "count_effective": effective_count,
                    "count_raw": len(novel_counterparts),
                    "tier_minimum": tier_minimum,
                    "count_pass": cp_count_pass,
                    "variation": cp_variation,
                    "pass_rate": cp_pass_rate,
                    "pass_rate_threshold": COUNTERPART_PASS_RATE,
                    "pass_rate_pass": cp_rate_pass,
                    "rule_version_weight": cp_weight,
                    "pass": counterpart_pass,
                },
            },
        }

    batch_result = criterion_results(LEVEL_BATCH_APPROVAL)
    auto_result = criterion_results(LEVEL_AUTONOMOUS)

    if auto_result["eligible"]:
        recommended = LEVEL_AUTONOMOUS
    elif batch_result["eligible"]:
        recommended = LEVEL_BATCH_APPROVAL
    else:
        recommended = LEVEL_ROBO_LABELS

    return {
        "standard_id": standard_id,
        "recommended_level": recommended,
        "measured_ceiling": measured_ceiling,
        "prevalence": prevalence,
        "structurally_complex": structurally_complex,
        "rule_version_change": rule_version_change,
        # Session 13: tracked-but-not-gated signal. A high disagreement
        # rate on a graduation-eligible standard is a flag for
        # content_type_notes or prompt review, not an auto-block.
        "ensemble_disagreement": ensemble_disagreement,
        "autonomous": auto_result,
        "batch_approval": batch_result,
    }


# ---------------------------------------------------------------------------
# Corpus helpers (for the CLI)
# ---------------------------------------------------------------------------


def load_novel_corpus(path: Path) -> list[dict[str, Any]]:
    with open(path) as f:
        data = json.load(f)
    cases = data.get("cases", data) if isinstance(data, dict) else data
    return cases if isinstance(cases, list) else []


def load_industry_cases(corpus_dir: Path) -> list[dict[str, Any]]:
    cases: list[dict[str, Any]] = []
    for path in sorted(corpus_dir.glob("*.json")):
        try:
            with open(path) as f:
                data = json.load(f)
        except Exception:
            continue
        c = data.get("cases", data) if isinstance(data, dict) else data
        if isinstance(c, list):
            cases.extend(c)
    return cases


def collect_counterparts_for_standard(
    standard_id: str,
    novel_cases: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """`novel_cases.json` entries with expected=pass on this standard."""
    return [
        c for c in novel_cases
        if c.get("standard_id") == standard_id
        and c.get("expected") == "pass"
    ]


def infer_primary_axes(
    standard_id: str,
    industry_cases: list[dict[str, Any]],
) -> tuple[str | None, str | None]:
    """Pick the most common (moment, content_type) for this standard
    in the industry corpus — used as the 'primary' axes for the
    variation analysis."""
    moment_counts: collections.Counter[str] = collections.Counter()
    ct_counts: collections.Counter[str] = collections.Counter()
    for c in industry_cases:
        if c.get("standard_id") != standard_id:
            continue
        if c.get("moment"):
            moment_counts[c["moment"]] += 1
        if c.get("content_type"):
            ct_counts[c["content_type"]] += 1
    moment = moment_counts.most_common(1)[0][0] if moment_counts else None
    ct = ct_counts.most_common(1)[0][0] if ct_counts else None
    return moment, ct


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------


def _load_json(path: Path) -> Any:
    with open(path) as f:
        return json.load(f)


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sub = parser.add_subparsers(dest="cmd", required=True)

    c = sub.add_parser("compute", help="Compute the readiness report.")
    c.add_argument("--reviews", type=Path, required=True,
                   help="JSON: list of review events {standard_id, machine_verdict, human_verdict, timestamp}.")
    c.add_argument("--overrides", type=Path, default=None,
                   help="JSON: list of override events {standard_id, actor_role, timestamp}.")
    c.add_argument("--industry", type=Path, default=Path("evals/industry"),
                   help="Industry corpus dir (for prevalence + primary axes).")
    c.add_argument("--novel", type=Path, default=Path("evals/novel_cases.json"),
                   help="Novel corpus (for counterpart cases).")
    c.add_argument("--engine-verdicts", type=Path, default=None,
                   help="JSON: {case_id: verdict} for counterpart pass rate.")
    c.add_argument("--drift-report", type=Path, default=None,
                   help="Latest drift report (for measured ceiling).")
    c.add_argument("--pipeline-events", type=Path, default=None,
                   help="JSON: list of pipeline events for per-standard "
                        "ensemble-disagreement rate (Session 13). Each event: "
                        "{standard_id, scan_proposed, validate_rejected}.")
    c.add_argument("--out", type=Path, default=Path("evals/graduation/readiness.json"))

    e = sub.add_parser("explain", help="Show breakdown for one standard.")
    e.add_argument("--readiness", type=Path, required=True)
    e.add_argument("--standard", required=True)

    args = parser.parse_args(argv)

    if args.cmd == "compute":
        return _cmd_compute(args)
    if args.cmd == "explain":
        return _cmd_explain(args)
    return 1


def _cmd_compute(args) -> int:
    reviews = _load_json(args.reviews) if args.reviews.exists() else []
    if isinstance(reviews, dict):
        reviews = reviews.get("entries", reviews.get("events", []))
    overrides = _load_json(args.overrides) if args.overrides and args.overrides.exists() else []
    if isinstance(overrides, dict):
        overrides = overrides.get("entries", overrides.get("events", []))

    measured_ceiling = 0.90
    if args.drift_report and args.drift_report.exists():
        dr = _load_json(args.drift_report)
        mc = dr.get("measured_ceiling")
        if isinstance(mc, (int, float)) and mc > 0:
            measured_ceiling = float(mc)

    industry = load_industry_cases(args.industry) if args.industry.exists() else []
    novel = load_novel_corpus(args.novel) if args.novel.exists() else []
    engine_verdicts: dict[str, str] = {}
    if args.engine_verdicts and args.engine_verdicts.exists():
        engine_verdicts = _load_json(args.engine_verdicts)

    # Session 13: optional ensemble-disagreement events. Per-standard
    # rate gets attached to each assessment when data is available.
    ensemble_by_standard: dict[str, dict[str, Any]] = {}
    if args.pipeline_events and args.pipeline_events.exists():
        events_raw = _load_json(args.pipeline_events)
        events = (
            events_raw.get("events", events_raw)
            if isinstance(events_raw, dict)
            else events_raw
        )
        if isinstance(events, list):
            ensemble_by_standard = compute_ensemble_disagreement_rate(events)

    # Group reviews + overrides by standard.
    reviews_by_std: dict[str, list[dict]] = collections.defaultdict(list)
    overrides_by_std: dict[str, list[dict]] = collections.defaultdict(list)
    for r in reviews:
        if r.get("standard_id"):
            reviews_by_std[r["standard_id"]].append(r)
    for o in overrides:
        if o.get("standard_id"):
            overrides_by_std[o["standard_id"]].append(o)

    all_standards = sorted(
        set(reviews_by_std) | set(overrides_by_std) | {
            c.get("standard_id") for c in industry if c.get("standard_id")
        } | {
            c.get("standard_id") for c in novel if c.get("standard_id")
        }
    )

    assessments: list[dict[str, Any]] = []
    for std in all_standards:
        std_reviews = reviews_by_std.get(std, [])
        std_overrides = overrides_by_std.get(std, [])
        std_cases = [c for c in industry if c.get("standard_id") == std]
        prevalence = compute_prevalence(std_cases)
        primary_moment, primary_ct = infer_primary_axes(std, industry)
        counterparts = collect_counterparts_for_standard(std, novel)

        assessment = assess_standard(
            std,
            reviews=std_reviews,
            overrides=std_overrides,
            total_verdicts=len(std_reviews),
            novel_counterparts=counterparts,
            counterpart_engine_verdicts=engine_verdicts,
            prevalence=prevalence,
            measured_ceiling=measured_ceiling,
            primary_moment=primary_moment,
            primary_content_type=primary_ct,
            ensemble_disagreement=ensemble_by_standard.get(std),
        )
        assessments.append(assessment)

    levels = collections.Counter(a["recommended_level"] for a in assessments)

    report = {
        "schema_version": "1.0.0",
        "generated_at": _dt.datetime.now(_dt.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "measured_ceiling": measured_ceiling,
        "autonomous_kappa_threshold": AUTONOMOUS_KAPPA_RATIO * measured_ceiling,
        "batch_approval_kappa_threshold": BATCH_APPROVAL_KAPPA_RATIO * measured_ceiling,
        "standards_evaluated": len(assessments),
        "by_level": dict(levels),
        "standards": assessments,
    }
    args.out.parent.mkdir(parents=True, exist_ok=True)
    with open(args.out, "w") as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print(f"Evaluated {len(assessments)} standards.")
    for level in LEVELS_ASC:
        print(f"  {level}: {levels.get(level, 0)}")
    print(f"Wrote {args.out}")
    return 0


def _cmd_explain(args) -> int:
    report = _load_json(args.readiness)
    for std in report.get("standards", []):
        if std.get("standard_id") != args.standard:
            continue
        print(json.dumps(std, indent=2, ensure_ascii=False))
        return 0
    print(f"Standard {args.standard} not in readiness report.", file=sys.stderr)
    return 2


if __name__ == "__main__":
    sys.exit(main())
