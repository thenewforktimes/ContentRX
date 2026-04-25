/**
 * Client-side Sentry init. Loaded once per page-view by Next.js when
 * NEXT_PUBLIC_SENTRY_DSN is set; no-op otherwise.
 *
 * Closes audit H-15. The previous implementation eagerly imported all
 * of @sentry/nextjs (~80kB minified) into the client bundle even
 * when DSN was unset — every page paid that cost, including signed-out
 * marketing pages. The dynamic-import below splits Sentry into its
 * own webpack chunk that only loads when DSN is set, AND only after
 * the page is interactive (since module init blocks first paint).
 *
 * onRouterTransitionStart stays as a stable module-level export
 * (Next.js looks it up at module load time and doesn't re-check). It
 * delegates to a captured reference once Sentry has loaded; before
 * then it's a no-op. Missing one or two router-transition events on
 * the very first navigation after a cold load is acceptable noise vs.
 * 80kB on every page.
 */

// Browser-side noise we want to ignore for quota reasons. Some are
// benign (user aborted, network blipped), others are expected API
// errors we've already handled in the UI.
const BROWSER_IGNORE_ERRORS = [
  "AbortError",
  "ResizeObserver loop limit exceeded",
  "ResizeObserver loop completed with undelivered notifications",
  // Browser extensions inject these; not our bugs.
  /^Non-Error promise rejection captured/,
  // Expected API error surfaces (we render them as UI, not "exceptions")
  /Rate limit exceeded/i,
  /Monthly quota exhausted/i,
];

// Lazily-resolved reference — populated once Sentry has loaded.
// `unknown` because we don't want to import Sentry's types at module
// load (that would defeat the chunk split).
type RouterTransitionFn = (...args: unknown[]) => void;
let _onRouterTransitionStart: RouterTransitionFn | undefined;

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;
if (dsn) {
  // Dynamic import — webpack creates a separate chunk for @sentry/nextjs
  // that only loads when this branch runs. The .then is fire-and-forget;
  // we don't block module evaluation on Sentry init.
  import("@sentry/nextjs")
    .then((Sentry) => {
      Sentry.init({
        dsn,
        // Lower than server (browser sessions are noisier; 5% is plenty
        // for perf insight without burning quota).
        tracesSampleRate: 0.05,
        replaysSessionSampleRate: 0,
        // Replay on errors only — capturing every session is privacy-
        // heavy and we don't need the storage cost.
        replaysOnErrorSampleRate: 0.1,
        sendDefaultPii: false,
        ignoreErrors: BROWSER_IGNORE_ERRORS,
      });
      _onRouterTransitionStart = Sentry.captureRouterTransitionStart as RouterTransitionFn;
    })
    .catch((err) => {
      // Sentry failed to load. Don't propagate — the alternative is a
      // hard-broken page that can't even render an error to the user.
      console.warn("Sentry browser init failed; continuing without it", err);
    });
}

/** Stable module-level export. Delegates to Sentry's
 * captureRouterTransitionStart once the SDK has loaded; until then,
 * a no-op. Next.js looks this up at module load and doesn't re-check.
 */
export function onRouterTransitionStart(...args: unknown[]): void {
  _onRouterTransitionStart?.(...args);
}
