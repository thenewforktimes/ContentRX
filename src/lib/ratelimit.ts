/**
 * Per-user rate limit via Upstash Redis.
 *
 * 60 requests / minute, sliding window — catches bursts without blocking
 * steady usage. Upstash client is lazy-initialized so the module can be
 * imported at build time without the env vars set.
 */

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { optionalEnv } from "./require-env";

let _redis: Redis | null = null;
let _ratelimit: Ratelimit | null = null;
let _waitlistRatelimit: Ratelimit | null = null;

function getRedis(): Redis {
  if (_redis) return _redis;

  // Accept both naming conventions:
  //   - UPSTASH_REDIS_REST_* — native Upstash naming (standalone Upstash account)
  //   - KV_REST_API_*        — Vercel Marketplace Upstash integration, which
  //                            preserves the legacy @vercel/kv env var names
  //                            for backward compat.
  // Identical Redis, different env var keys depending on how the DB was
  // provisioned. Try the native names first, fall back to Vercel Marketplace.
  // optionalEnv treats `X=""` the same as unset so an empty placeholder
  // doesn't silently win the ?? chain. Matches redis.ts; previously
  // ratelimit.ts used raw process.env and a `KV_REST_API_URL` user with
  // `UPSTASH_REDIS_REST_URL=""` got "credentials not set" instead of
  // falling through to the Marketplace var.
  const url =
    optionalEnv("UPSTASH_REDIS_REST_URL") ?? optionalEnv("KV_REST_API_URL");
  const token =
    optionalEnv("UPSTASH_REDIS_REST_TOKEN") ??
    optionalEnv("KV_REST_API_TOKEN");
  if (!url || !token) {
    throw new Error(
      "Redis credentials not set. Expected UPSTASH_REDIS_REST_URL + " +
        "UPSTASH_REDIS_REST_TOKEN, or KV_REST_API_URL + KV_REST_API_TOKEN " +
        "(Vercel Marketplace integration).",
    );
  }

  _redis = new Redis({ url, token });
  return _redis;
}

function getRatelimit(): Ratelimit {
  if (_ratelimit) return _ratelimit;
  _ratelimit = new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(60, "60 s"),
    prefix: "ratelimit:check",
    analytics: true,
  });
  return _ratelimit;
}

// Waitlist limiter — separate prefix so the per-user check budget at
// `ratelimit:check` is unrelated. 5 signups per hour per IP is generous
// for legitimate geo-blocked traffic (a visitor submits once, maybe
// twice if they typo the email), but caps the obvious abuse vector:
// Resend billing DoS via mass-spammed signups rotating email addresses
// past the per-(email, day) Redis dedupe in the route. (Audit H1,
// 2026-05-13.)
function getWaitlistRatelimit(): Ratelimit {
  if (_waitlistRatelimit) return _waitlistRatelimit;
  _waitlistRatelimit = new Ratelimit({
    redis: getRedis(),
    limiter: Ratelimit.slidingWindow(5, "1 h"),
    prefix: "ratelimit:waitlist",
    analytics: true,
  });
  return _waitlistRatelimit;
}

export type RatelimitResult = {
  success: boolean;
  remaining: number;
  reset: number;
};

export async function checkRateLimit(userId: string): Promise<RatelimitResult> {
  const rl = getRatelimit();
  const { success, remaining, reset } = await rl.limit(userId);
  return { success, remaining, reset };
}

/**
 * Helper for non-/api/check routes: run the per-user rate limit and
 * return the standard 429 NextResponse when exceeded, or `null` when
 * the call may proceed.
 *
 * Usage:
 *
 *   const rl = await enforceRateLimit(user.id);
 *   if (rl) return rl;
 *
 * 429 response shape mirrors /api/check + /api/suggest-fix:
 *   { error: "Rate limit exceeded", retry_after_seconds }
 *   header: retry-after = ceil((reset - now) / 1000)
 */
export async function enforceRateLimit(
  userId: string,
): Promise<Response | null> {
  const rl = await checkRateLimit(userId);
  if (rl.success) return null;
  const retryAfterSeconds = Math.max(
    0,
    Math.ceil((rl.reset - Date.now()) / 1000),
  );
  return new Response(
    JSON.stringify({
      error: "Rate limit exceeded",
      retry_after_seconds: retryAfterSeconds,
    }),
    {
      status: 429,
      headers: {
        "content-type": "application/json",
        "retry-after": String(retryAfterSeconds),
      },
    },
  );
}

/**
 * IP-based limiter for /api/waitlist. The route is intentionally
 * unauthenticated (geo-blocked visitors must reach it), so we can't
 * key on a user id — `ip` here comes from the first hop of
 * `x-forwarded-for` (the visitor-facing IP set by Vercel's edge). The
 * `enforceRateLimit` shape is preserved: returns a 429 Response on
 * exhaust or `null` to proceed.
 *
 * Bucket: 5 / hour. Real users submit once or twice; this gives them
 * runway while shutting down trivial spam loops.
 */
export async function enforceWaitlistRateLimit(
  ip: string,
): Promise<Response | null> {
  const rl = getWaitlistRatelimit();
  const { success, reset } = await rl.limit(ip);
  if (success) return null;
  const retryAfterSeconds = Math.max(0, Math.ceil((reset - Date.now()) / 1000));
  return new Response(
    JSON.stringify({
      error:
        "Too many waitlist submissions from this network. Try again later, or email hello@contentrx.io.",
      retry_after_seconds: retryAfterSeconds,
    }),
    {
      status: 429,
      headers: {
        "content-type": "application/json",
        "retry-after": String(retryAfterSeconds),
      },
    },
  );
}
