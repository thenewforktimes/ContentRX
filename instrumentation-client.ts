/**
 * Client-side Sentry init. Loaded once per page-view by Next.js when
 * NEXT_PUBLIC_SENTRY_DSN is set; no-op otherwise.
 */

import * as Sentry from "@sentry/nextjs";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  Sentry.init({
    dsn,
    // Lower than server (browser sessions are noisier; 5% is plenty for
    // perf insight without burning quota).
    tracesSampleRate: 0.05,
    replaysSessionSampleRate: 0,
    // Replay on errors only — capturing every session is privacy-heavy
    // and we don't need the storage cost.
    replaysOnErrorSampleRate: 0.1,
    sendDefaultPii: false,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
