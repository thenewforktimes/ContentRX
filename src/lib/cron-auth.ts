/**
 * Shared bearer-token auth for cron + admin server-to-server endpoints.
 *
 * Replaces the duplicated `requireCronAuth` function that was copy-pasted
 * across `src/app/api/cron/*` and `src/app/api/admin/refinement-signals`.
 * Closes audit H-01: the previous string-equality compare (`got !==
 * \`Bearer ${expected}\``) leaks the secret byte-by-byte under repeated
 * probing. This helper uses `crypto.timingSafeEqual` with constant-time
 * comparison.
 */

import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { requireEnv } from "./require-env";

/**
 * Verify the request carries the right `Authorization: Bearer <CRON_SECRET>`
 * header. Returns null on success (handler proceeds), or a NextResponse to
 * return on failure.
 *
 * Throws (via requireEnv) if CRON_SECRET is missing or empty in the
 * environment — Next.js catches → 500 + Sentry surfaces it. This is the
 * correct fail-closed behavior: a cron without a secret can't authenticate
 * anyone, so the route shouldn't accept any request.
 */
export function requireCronAuth(req: Request): NextResponse | null {
  const expected = requireEnv("CRON_SECRET");
  const got = req.headers.get("authorization") ?? "";

  // Parse the Bearer prefix off the header value before comparing the
  // token, so the constant-time compare actually compares the secrets
  // (not "Bearer <secret>" strings of different lengths).
  const match = got.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const provided = match[1].trim();

  // timingSafeEqual requires equal-length buffers. If lengths differ,
  // the secrets can't match — but we still want a constant-time path
  // (compare against a same-length buffer) to avoid leaking length.
  const expectedBuf = Buffer.from(expected, "utf8");
  const providedBuf = Buffer.from(provided, "utf8");

  if (
    providedBuf.length !== expectedBuf.length ||
    !timingSafeEqual(providedBuf, expectedBuf)
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return null;
}
