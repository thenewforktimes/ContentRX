/**
 * Preference-informed suggestion ranker — human-eval build plan Session 32.
 *
 * TS mirror of `src/content_checker/suggestion_ranking.py`. Any
 * surface that generates multiple counterfactual suggestions for a
 * violation (today none, by design — the engine emits one per
 * violation; see `src/content_checker/models.py`) can call this to
 * sort them by alignment with accumulated pairwise preferences.
 *
 * Parity: both files must agree on Jaccard semantics + weighting so
 * TS-side and Python-side ranking produce the same order on the same
 * inputs. Parity is test-covered on the Python side (lightweight
 * scenarios) and mirrored in the TS test file.
 */

export interface PreferencePairSignal {
  standardId: string;
  moment: string | null;
  preferredText: string;
  nonPreferredText: string;
  sampleSize: number;
}

export interface RankedSuggestion {
  text: string;
  originalIndex: number;
  alignmentScore: number;
  matchedSignalCount: number;
  reasons: string[];
}

const TOKEN_RE = /[A-Za-z0-9']+/g;

function tokens(text: string): string[] {
  return text.toLowerCase().match(TOKEN_RE) ?? [];
}

function ngrams(toks: string[], n: number): Set<string> {
  const out = new Set<string>();
  if (toks.length < n) return out;
  for (let i = 0; i <= toks.length - n; i++) {
    out.add(toks.slice(i, i + n).join("\u0000"));
  }
  return out;
}

export function jaccardSimilarity(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  const gramsA = new Set([...ngrams(ta, 1), ...ngrams(ta, 2)]);
  const gramsB = new Set([...ngrams(tb, 1), ...ngrams(tb, 2)]);
  if (gramsA.size === 0 || gramsB.size === 0) return 0;
  let inter = 0;
  for (const g of gramsA) if (gramsB.has(g)) inter += 1;
  const union = gramsA.size + gramsB.size - inter;
  return union === 0 ? 0 : inter / union;
}

function relevance(
  signal: PreferencePairSignal,
  standardId: string,
  moment: string | null,
): number {
  if (signal.standardId !== standardId) return 0;
  if (moment !== null && signal.moment === moment) return 1.0;
  return 0.5;
}

function logWeight(n: number): number {
  if (n <= 0) return 0;
  return Math.log1p(n) / Math.log1p(10);
}

export interface RankOptions {
  standardId: string;
  moment: string | null;
  signals: readonly PreferencePairSignal[];
  minSimilarityDelta?: number;
}

export function rankSuggestions(
  candidates: readonly string[],
  opts: RankOptions,
): RankedSuggestion[] {
  const minDelta = opts.minSimilarityDelta ?? 0.05;

  const scored: RankedSuggestion[] = candidates.map((text, i) => ({
    text,
    originalIndex: i,
    alignmentScore: 0,
    matchedSignalCount: 0,
    reasons: [],
  }));

  for (const suggestion of scored) {
    for (const signal of opts.signals) {
      const rel = relevance(signal, opts.standardId, opts.moment);
      if (rel === 0) continue;
      const simPref = jaccardSimilarity(
        suggestion.text,
        signal.preferredText,
      );
      const simWeak = jaccardSimilarity(
        suggestion.text,
        signal.nonPreferredText,
      );
      const delta = simPref - simWeak;
      if (Math.abs(delta) < minDelta) continue;
      const weight = logWeight(signal.sampleSize) * rel;
      const contribution = delta * weight;
      suggestion.alignmentScore += contribution;
      suggestion.matchedSignalCount += 1;
      if (suggestion.reasons.length < 3) {
        const direction = contribution > 0 ? "+preferred" : "-preferred";
        const momentPart = signal.moment ? `@${signal.moment}` : "";
        suggestion.reasons.push(
          `${signal.standardId}${momentPart} ${direction} (δ=${delta.toFixed(2)}, n=${signal.sampleSize})`,
        );
      }
    }
    // Round to 4 decimals to match the Python side's `round(score, 4)`.
    suggestion.alignmentScore =
      Math.round(suggestion.alignmentScore * 10000) / 10000;
  }

  scored.sort(
    (a, b) =>
      b.alignmentScore - a.alignmentScore || a.originalIndex - b.originalIndex,
  );
  return scored;
}

export interface ExportItem {
  pair: {
    standard_id?: string;
    moment?: string | null;
    expected_preferred?: "left" | "right" | null;
    left_text?: string;
    right_text?: string;
  };
  responses: { preferred?: string }[];
}

export function signalsFromExport(
  exportData: { items?: ExportItem[] },
  minSampleSize = 1,
): PreferencePairSignal[] {
  const out: PreferencePairSignal[] = [];
  for (const item of exportData.items ?? []) {
    const pair = item.pair ?? {};
    const expected = pair.expected_preferred;
    if (expected !== "left" && expected !== "right") continue;
    if (!pair.standard_id) continue;
    const left = pair.left_text ?? "";
    const right = pair.right_text ?? "";
    if (!left || !right) continue;
    const preferred = expected === "left" ? left : right;
    const nonPreferred = expected === "left" ? right : left;
    let aligned = 0;
    for (const r of item.responses ?? []) {
      if (r.preferred === expected) aligned += 1;
    }
    if (aligned < minSampleSize) continue;
    out.push({
      standardId: pair.standard_id,
      moment: pair.moment ?? null,
      preferredText: preferred,
      nonPreferredText: nonPreferred,
      sampleSize: aligned,
    });
  }
  return out;
}
