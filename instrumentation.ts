/**
 * Next.js instrumentation hook — runs once at server startup.
 *
 * Initializes Sentry on the Node and Edge runtimes. Sentry stays inert
 * if SENTRY_DSN isn't set, so dev / preview environments without the
 * env var don't pay any startup cost.
 */

import * as Sentry from "@sentry/nextjs";

export async function register() {
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;

  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init({
      dsn,
      tracesSampleRate: 0.1,
      // Hide PII from breadcrumbs and stack frames. The /api/check route
      // never logs raw text (only sha256 hashes), but defense-in-depth.
      sendDefaultPii: false,
    });
  } else if (process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn,
      tracesSampleRate: 0.1,
      sendDefaultPii: false,
    });
  }
}

export const onRequestError = Sentry.captureRequestError;
