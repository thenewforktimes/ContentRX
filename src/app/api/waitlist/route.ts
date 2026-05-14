/**
 * POST /api/waitlist — capture a signup from a geo-blocked visitor.
 *
 * Triggered by the form on /waitlist. The visitor's country/region is
 * detected from Vercel edge headers (the same headers the middleware
 * uses to enforce the geo-block). The signup is delivered to the
 * founder as a Resend email, deduped per (email, day) so a form
 * double-submit doesn't generate two notifications.
 *
 * No DB write at launch — the expected signup volume is very low
 * (geo-blocked traffic that bothered to fill in the form), and adding
 * a waitlist_signups table is friction that's better deferred. When
 * volume justifies it, replace this endpoint with a proper Drizzle
 * write to a waitlist_signups table and add an /admin/waitlist
 * surface.
 *
 * No Clerk auth. The middleware explicitly bypasses /api/waitlist via
 * the always-allowed matcher so geo-blocked visitors can hit it.
 *
 * Rate limit posture:
 *   - Dedupe by email-per-day blocks accidental flooding from one
 *     submitter.
 *   - IP-based limit at 5/hour via `enforceWaitlistRateLimit`, prefix
 *     `ratelimit:waitlist` (kept distinct from the per-user
 *     `ratelimit:check` budget). Caps the spam-rotating-emails vector
 *     that the per-(email, day) dedupe alone can't catch — without
 *     this the route is a Resend billing DoS against the founder
 *     inbox. (Audit H1, 2026-05-13.)
 */

import { z } from "zod";
import { NextResponse } from "next/server";
import { sendEmail, appUrl } from "@/lib/email";
import { enforceWaitlistRateLimit } from "@/lib/ratelimit";
import { logSafeError } from "@/lib/safe-error-log";
import { WaitlistSignupEmail } from "@/emails/waitlist-signup";

const RequestSchema = z.object({
  email: z.string().email().max(254),
  // Optional client-supplied region tag (the /waitlist page captures
  // the value from the redirect's `?region=` query param and posts it
  // back so the email shows the same region the visitor saw on
  // screen). Server falls back to the live geo headers if the client
  // omits this. Trimmed to 32 chars defensively.
  region: z.string().max(32).optional(),
});

function founderEmail(): string {
  return process.env.FOUNDER_EMAIL ?? "hello@contentrx.io";
}

function readGeoFromHeaders(req: Request): string {
  const country = req.headers.get("x-vercel-ip-country") ?? "";
  const region = req.headers.get("x-vercel-ip-country-region") ?? "";
  if (!country) return "";
  return region ? `${country}-${region}` : country;
}

/**
 * Best-effort caller-IP extraction for the rate-limit key. Vercel sets
 * `x-forwarded-for` with the visitor's edge IP first; downstream proxies
 * append. We take the first element. Falls back to `x-real-ip`. If both
 * are missing (local dev, edge misconfig), we key on a constant so the
 * limiter still gates — preferring "limit everyone together" over "limit
 * nobody at all" in the misconfig case.
 */
function readClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = req.headers.get("x-real-ip");
  if (real) return real;
  return "unknown";
}

export async function POST(req: Request) {
  // Rate-limit BEFORE body parse — cheap to do first, and a flood
  // shouldn't be charged Vercel function CPU time parsing JSON.
  const rl = await enforceWaitlistRateLimit(readClientIp(req));
  if (rl) return rl;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      {
        error:
          "The request body was not valid JSON. Resubmit from the form on /waitlist, or email hello@contentrx.io if the form keeps failing.",
      },
      { status: 400 },
    );
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          "The submitted email or region failed validation. Check that the email is well-formed and resubmit, or email hello@contentrx.io if the form keeps rejecting a valid address.",
        details: parsed.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { email, region: clientRegion } = parsed.data;
  const serverRegion = readGeoFromHeaders(req);
  const region = clientRegion || serverRegion || "";
  const userAgent = req.headers.get("user-agent") ?? "";
  const submittedAt = new Date().toISOString();

  // Dedupe per (email, day) so a form double-submit doesn't generate
  // two notifications. The Resend helper checks Redis for the key
  // before sending; on a duplicate, it returns { ok: true, deduplicated }
  // without firing the email.
  const day = submittedAt.slice(0, 10); // YYYY-MM-DD
  const dedupeKey = `waitlist:${email.toLowerCase()}:${day}`;

  try {
    const result = await sendEmail({
      to: founderEmail(),
      subject: `[WAITLIST] ${email} (${region || "unknown region"})`,
      react: WaitlistSignupEmail({
        email,
        region,
        userAgent,
        submittedAt,
      }),
      dedupeKey,
    });

    if (!result.ok) {
      logSafeError("[api/waitlist] founder notify failed", {
        message: result.error,
      });
      // We still return success to the visitor — the failure was
      // ContentRX-side and the user did nothing wrong. The founder
      // sees the log and the visitor doesn't see a confusing error
      // for a problem they can't fix.
    }

    return NextResponse.json({
      ok: true,
      message: "Got it. ContentRX will email you when access opens in your region.",
      _app_url: appUrl(),
    });
  } catch (err) {
    logSafeError("[api/waitlist] unexpected error", err);
    return NextResponse.json(
      { error: "Could not record signup. Try again in a few minutes." },
      { status: 500 },
    );
  }
}
