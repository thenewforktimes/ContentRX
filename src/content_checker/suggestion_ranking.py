"""Preference-informed ranking of counterfactual suggestions.

Human-eval build plan Session 32. When the generator proposes more
than one rewrite for a flagged violation, this module scores each
candidate against the preference-pair bank from Session 31 and
returns the list sorted by preference alignment.

Design (conservative):
- The ranker is a stateless pure function. No I/O, no LLM calls.
- Candidates are ranked by a *preference alignment score* that
  compares each candidate to the preferred/non-preferred sides of
  relevant preference pairs from the same `(moment, standard_id)`
  context. A candidate resembling the preferred side more than the
  non-preferred side scores positive; the inverse scores negative.
- Similarity uses Jaccard over lowercased token n-grams (unigrams +
  bigrams). Simple, deterministic, language-agnostic enough for
  current copy, no external deps.
- Ties break by original position so the generator's own ordering
  acts as the final fallback.

This module never emits `verdict` changes — Session 32's scope is
suggestion ranking, not re-classification.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field


@dataclass(frozen=True)
class PreferencePairSignal:
    """Minimal shape the ranker needs from a preference pair and its
    aggregated responses.

    `standard_id` / `moment` scope relevance. `preferred_text` is the
    side users consistently picked; `non_preferred_text` is the weaker
    side. `sample_size` weights the signal (more responses ⇒ more
    weight).
    """

    standard_id: str
    moment: str | None
    preferred_text: str
    non_preferred_text: str
    sample_size: int


@dataclass
class RankedSuggestion:
    """A candidate rewrite annotated with its preference alignment."""

    text: str
    original_index: int
    alignment_score: float = 0.0
    matched_signal_count: int = 0
    reasons: list[str] = field(default_factory=list)


# ---------------------------------------------------------------------------
# Tokenisation + similarity
# ---------------------------------------------------------------------------

_TOKEN_RE = re.compile(r"[A-Za-z0-9']+")


def _tokens(text: str) -> list[str]:
    return _TOKEN_RE.findall(text.lower())


def _ngrams(tokens: list[str], n: int) -> set[tuple[str, ...]]:
    if len(tokens) < n:
        return set()
    return {tuple(tokens[i : i + n]) for i in range(len(tokens) - n + 1)}


def jaccard_similarity(a: str, b: str) -> float:
    """Jaccard similarity over the union of unigrams and bigrams.

    Returns 0.0 when either side is empty. Values fall in [0, 1].
    """
    ta, tb = _tokens(a), _tokens(b)
    grams_a = _ngrams(ta, 1) | _ngrams(ta, 2)
    grams_b = _ngrams(tb, 1) | _ngrams(tb, 2)
    if not grams_a or not grams_b:
        return 0.0
    inter = grams_a & grams_b
    union = grams_a | grams_b
    return len(inter) / len(union)


# ---------------------------------------------------------------------------
# Ranking
# ---------------------------------------------------------------------------


def _relevance(signal: PreferencePairSignal, standard_id: str, moment: str | None) -> float:
    """How much this preference signal matches the violation context.

    1.0 when both standard_id AND moment match.
    0.5 when only standard_id matches.
    0.0 when standard_id doesn't match — the signal is unrelated.
    """
    if signal.standard_id != standard_id:
        return 0.0
    if moment is not None and signal.moment == moment:
        return 1.0
    return 0.5


def _log_weight(sample_size: int) -> float:
    """Logarithmic weighting so a pair with 100 responses doesn't
    drown out one with 5. Floors at 0 for zero responses."""
    if sample_size <= 0:
        return 0.0
    # log1p(n) — 0 at n=0, ≈2.4 at n=10, ≈4.6 at n=100. The divide-by-
    # 2.4 normalises the common case (n≈10) to weight ≈1.0.
    import math

    return math.log1p(sample_size) / math.log1p(10)


def rank_suggestions(
    candidates: list[str],
    *,
    standard_id: str,
    moment: str | None,
    signals: list[PreferencePairSignal],
    min_similarity_delta: float = 0.05,
) -> list[RankedSuggestion]:
    """Rank candidate rewrites by preference alignment.

    Returns a new list in descending `alignment_score` order. Ties
    break by original position (smaller `original_index` first).

    `min_similarity_delta` — the per-signal margin that counts as a
    "real" alignment call. If the candidate's similarity to the
    preferred side is within this delta of its similarity to the non-
    preferred side, that signal contributes zero. Keeps noise out.
    """
    scored: list[RankedSuggestion] = []

    for i, text in enumerate(candidates):
        score = 0.0
        matched = 0
        reasons: list[str] = []

        for signal in signals:
            relevance = _relevance(signal, standard_id, moment)
            if relevance == 0.0:
                continue

            sim_pref = jaccard_similarity(text, signal.preferred_text)
            sim_weak = jaccard_similarity(text, signal.non_preferred_text)
            delta = sim_pref - sim_weak
            if abs(delta) < min_similarity_delta:
                continue

            weight = _log_weight(signal.sample_size) * relevance
            contribution = delta * weight
            score += contribution
            matched += 1

            direction = "+preferred" if contribution > 0 else "-preferred"
            reasons.append(
                f"{signal.standard_id}"
                + (f"@{signal.moment}" if signal.moment else "")
                + f" {direction} "
                + f"(δ={delta:+.2f}, n={signal.sample_size})"
            )

        scored.append(
            RankedSuggestion(
                text=text,
                original_index=i,
                alignment_score=round(score, 4),
                matched_signal_count=matched,
                reasons=reasons[:3],  # cap at 3 for readability
            )
        )

    scored.sort(
        key=lambda s: (-s.alignment_score, s.original_index),
    )
    return scored


# ---------------------------------------------------------------------------
# Signal adapter
# ---------------------------------------------------------------------------


def signals_from_export(
    export: dict,
    min_sample_size: int = 1,
) -> list[PreferencePairSignal]:
    """Adapt a `/api/preferences/export` dump (Session 31) into the
    ranker's input shape.

    For each pair:
      - Requires `expected_preferred` to be set. Judgment probes have
        no canonical winner and are skipped.
      - `preferred_text` is whichever side matches `expected_preferred`;
        `non_preferred_text` is the other.
      - `sample_size` is the number of aligned responses. The non-
        aligned count is the conflict signal; the ranker folds
        conflict into the alignment delta via the similarity math,
        not here.
      - Pairs with fewer than `min_sample_size` aligned responses
        are dropped so sparse signal doesn't swing rankings.
    """
    out: list[PreferencePairSignal] = []
    for item in export.get("items", []):
        pair = item.get("pair") or {}
        expected = pair.get("expected_preferred")
        if expected not in ("left", "right"):
            continue
        std = pair.get("standard_id")
        if not std:
            continue
        left_text = pair.get("left_text") or ""
        right_text = pair.get("right_text") or ""
        preferred = left_text if expected == "left" else right_text
        non_preferred = right_text if expected == "left" else left_text
        if not preferred or not non_preferred:
            continue

        aligned = 0
        for r in item.get("responses", []):
            if r.get("preferred") == expected:
                aligned += 1

        if aligned < min_sample_size:
            continue

        out.append(
            PreferencePairSignal(
                standard_id=std,
                moment=pair.get("moment"),
                preferred_text=preferred,
                non_preferred_text=non_preferred,
                sample_size=aligned,
            )
        )
    return out
