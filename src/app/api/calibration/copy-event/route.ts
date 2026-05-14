/**
 * POST /api/calibration/copy-event — record a passive customer-copy
 * signal in suggestion_candidates with source='customer_copy'.
 *
 * Block 3a of the calibration plan. The dashboard's Copy button on
 * each finding card (Block 1b) dispatches a `cx-suggestion-copied`
 * window event AND fires this endpoint fire-and-forget. The event
 * stays for any future client-side listeners; the endpoint persists
 * the signal for substrate-side analytics.
 *
 * Trust + privacy posture:
 *   - Lower trust than customer-rewrite. The user copied the LLM's
 *     suggestion as-is; that's a passive positive signal but not a
 *     hand-curated rewrite.
 *   - No customer input strings are written. The row carries the
 *     ENGINE'S OWN suggestion text (candidateText) plus engine-emitted
 *     issue context — both come from the LLM, not the customer. The
 *     customer-input path lives at customer_flagged_reviews under the
 *     Flag-for-Review consent flow (ADR 2026-05-11).
 *   - Failure is non-fatal. The customer's clipboard write already
 *     happened client-side; this endpoint exists for substrate
 *     accounting only.
 *
 * Substrate boundary (ADR 2026-04-25): the customer browser sends
 * only public-envelope fields (submittedText, suggestion, severity,
 * confidence, issue). Server-side correlation against the
 * violations table recovers (moment, content_type, standard_id) by
 * joining on (userId, textHash) — same pattern as
 * /api/violations/adjust.
 */

import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { envelope } from "@/lib/api-envelope";
import { resolveAuth } from "@/lib/auth";
import { hashText } from "@/lib/log-violations";
import {
  detectSensitivePatterns,
  sensitiveDataErrorMessage,
} from "@/lib/pii-screen";
import { checkRateLimit } from "@/lib/ratelimit";
import { logSafeError } from "@/lib/safe-error-log";
import { teamScope } from "@/lib/team-scope";
import { sanitizeZodIssues } from "@/lib/zod-errors";
import { getDb, schema } from "@/db";

import { corsJson, corsPreflight } from "@/lib/cors";

export async function OPTIONS(req: Request) {
  return corsPreflight(req);
}

const RequestSchema = z.object({
  submittedText: z.string().min(1).max(100_000),
  suggestion: z.string().min(1).max(100_000),
  severity: z.string().min(1).max(32),
  confidence: z.number().min(0).max(1),
  issue: z.string().min(1).max(500),
});

export async function POST(req: Request) {
  const json = (body: unknown, init?: ResponseInit) =>
    corsJson(req, body, init);

  const auth = await resolveAuth(req);
  if ("status" in auth) {
    return json({ error: auth.message }, { status: auth.status });
  }

  const body = await req.json().catch(() => null);
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return json(
      {
        error: "Invalid request",
        issues: sanitizeZodIssues(parsed.error.issues),
      },
      { status: 400 },
    );
  }

  // PII pre-screen on the LLM's suggestion + the user's input.
  // The candidate row stores the suggestion text (engine output,
  // not the user's writing) and the input hash; both still get
  // screened defense-in-depth.
  const candidates = [
    parsed.data.submittedText,
    parsed.data.suggestion,
    parsed.data.issue,
  ].join("\n");
  const sensitive = detectSensitivePatterns(candidates);
  if (sensitive.length > 0) {
    return json(
      {
        error: sensitiveDataErrorMessage(sensitive),
        patterns: sensitive,
      },
      { status: 400 },
    );
  }

  // Same per-user budget as /api/check + /api/violations/adjust.
  const rl = await checkRateLimit(auth.user.id);
  if (!rl.success) {
    return json(
      { error: "Rate limit exceeded" },
      { status: 429 },
    );
  }

  const teamId = teamScope(auth);
  const textHash = hashText(parsed.data.submittedText);

  try {
    const db = getDb();

    // Server-side correlation: recover substrate context by joining
    // against violations on (userId, textHash). Audit H2 (2026-05-13):
    // correlation is now a STRICT provenance gate — we refuse to
    // insert when there's no matching violation row for this user.
    // The customer-supplied `suggestion` and `issue` strings ride
    // through this endpoint without server-side verification (the
    // engine never persists plaintext suggestions per SECURITY.md,
    // so we can't hash-compare). Strict correlation tightens the
    // boundary: every candidate row must trace to an engine event
    // this user actually triggered, closing the "spam the corpus
    // with arbitrary text claiming it came from the engine" vector.
    // The Flag-for-Review consent flow remains the only path for
    // customer-authored strings into substrate (ADR 2026-05-11).
    const correlated = await db
      .select({
        moment: schema.violations.moment,
        contentType: schema.violations.contentType,
        standardId: schema.violations.standardId,
      })
      .from(schema.violations)
      .where(
        and(
          eq(schema.violations.userId, auth.user.id),
          eq(schema.violations.textHash, textHash),
        ),
      )
      .orderBy(desc(schema.violations.createdAt))
      .limit(1);

    if (correlated.length === 0) {
      // No matching violation for this (user, textHash). Either the
      // client is sending stale UI state, replaying after a wipe, or
      // attempting to plant unverified content. Refuse without
      // raising a 5xx — this is a caller-state problem, not a server
      // failure.
      return json(
        envelope({ recorded: false, reason: "no_correlated_violation" }),
        { status: 422 },
      );
    }

    const substrate = correlated[0]!;

    await db.insert(schema.suggestionCandidates).values({
      moment: substrate.moment,
      contentType: substrate.contentType,
      standardId: substrate.standardId,
      source: "customer_copy",
      sourceUserId: auth.user.id,
      sourceTeamOwnerUserId: teamId,
      inputHash: textHash,
      candidateText: parsed.data.suggestion,
      issueContext: parsed.data.issue,
      status: "pending",
    });

    return json(envelope({ recorded: true }), { status: 201 });
  } catch (err) {
    // Audit H2 (2026-05-13): return 500 on real DB failure so retries
    // and alerting work. The client-side clipboard write already
    // succeeded — the customer's UX doesn't depend on this — but
    // CLAUDE.md "no silently-swallowed errors" wins over the previous
    // 200-with-recorded:false shape. Sentry catches via logSafeError.
    logSafeError("copy-event candidate insert failed", err);
    return json(
      { error: "Could not record calibration signal" },
      { status: 500 },
    );
  }
}
