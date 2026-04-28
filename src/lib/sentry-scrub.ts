/**
 * Sentry `beforeSend` scrubber.
 *
 * `instrumentation.ts` (server) and `instrumentation-client.ts`
 * (browser) both call `Sentry.init` with `sendDefaultPii: false` —
 * that's the right baseline. This module is the second layer: even
 * when default PII handling is off, an unhandled error can still
 * carry user content in places we DON'T want it:
 *
 *   - `event.request.data` — the POST body to /api/check, /api/check
 *     classify, /api/suggest-fix, etc. carries raw text.
 *   - `event.request.headers.authorization` — bearer cx_… tokens.
 *   - `event.request.headers.cookie` — Clerk session cookies.
 *   - `event.message` / `event.exception[i].value` — when a thrown
 *     error includes the input string in its message (the error
 *     paths we audited don't, but defense-in-depth: truncate
 *     anything implausibly long).
 *   - `event.breadcrumbs[i].data` — captured fetch/console
 *     breadcrumbs may include text payloads.
 *   - `event.extra` / `event.tags` — anything we (or a library) ever
 *     attaches with a key like `text`, `body`, `input`, `content`.
 *
 * The scrubber runs synchronously on every event Sentry would send.
 * It NEVER drops events outright (returning null from beforeSend
 * would silently lose visibility into real bugs); it only redacts
 * fields that could carry user content.
 */

/**
 * Structural type for the Sentry Event subset the scrubber touches.
 * Inlined to avoid taking a hard dependency on @sentry/types — the
 * @sentry/nextjs package bundles its own copy of the protocol types
 * but doesn't always re-export them. Defining only the fields we
 * read keeps the scrubber stable across SDK upgrades.
 */
interface SentryEvent {
  message?: string;
  request?: {
    data?: unknown;
    headers?: Record<string, string | string[] | undefined>;
    cookies?: Record<string, string | string[]>;
    // Sentry's QueryParams allows string, Record<>, or [string,string][]
    // — accept all three so this type stays a valid supertype of the
    // SDK's own Event['request'].
    query_string?: string | Record<string, string> | Array<[string, string]>;
  };
  exception?: { values?: Array<{ value?: string; type?: string }> };
  extra?: Record<string, unknown>;
  tags?: Record<string, unknown>;
  breadcrumbs?: Array<{
    message?: string;
    data?: Record<string, unknown>;
    category?: string;
  }>;
}

/** Field names that could carry user-pasted strings. Lowercased
 * comparison is intentional — `Text`, `Content`, `Body` all hit. */
const SCRUB_KEYS = new Set<string>([
  "text",
  "body",
  "input",
  "content",
  "string",
  "raw",
]);

/** Fields on `request.headers` we never want in Sentry. */
const SCRUB_HEADERS = new Set<string>([
  "authorization",
  "cookie",
  "x-internal-secret",
]);

/** Hard truncation ceiling on any free-text Sentry field. The error
 * type + first 200 chars is enough to triage. Beyond that, we're
 * just storing user content. */
const MESSAGE_MAX_CHARS = 200;

function truncate(s: string): string {
  return s.length <= MESSAGE_MAX_CHARS
    ? s
    : `${s.slice(0, MESSAGE_MAX_CHARS)}…[truncated]`;
}

function scrubBag(bag: Record<string, unknown> | undefined): void {
  if (!bag || typeof bag !== "object") return;
  for (const key of Object.keys(bag)) {
    if (SCRUB_KEYS.has(key.toLowerCase())) {
      bag[key] = "[scrubbed]";
    }
  }
}

function scrubHeaders(
  headers: Record<string, string | string[] | undefined> | undefined,
): void {
  if (!headers) return;
  for (const key of Object.keys(headers)) {
    if (SCRUB_HEADERS.has(key.toLowerCase())) {
      headers[key] = "[scrubbed]";
    }
  }
}

/**
 * Scrub user-content-shaped fields from a Sentry event in-place.
 * Returns the same event (Sentry's beforeSend signature wants a
 * mutated event, not a fresh object).
 *
 * Typed against a structural subset rather than @sentry/types — the
 * Sentry SDKs accept any object that mutates the documented fields,
 * and we only touch a small handful.
 */
export function scrubSentryEvent<T extends SentryEvent>(event: T): T {
  // Drop the request body — POSTs to /api/check carry raw user text.
  if (event.request) {
    event.request.data = undefined;
    scrubHeaders(event.request.headers);
    if (event.request.cookies) {
      event.request.cookies = undefined;
    }
    if (event.request.query_string) {
      // Query strings are usually safe but can carry handoff codes /
      // OAuth state. Drop to be safe.
      event.request.query_string = undefined;
    }
  }

  // Truncate top-level message + each exception value.
  if (typeof event.message === "string") {
    event.message = truncate(event.message);
  }
  if (event.exception?.values) {
    for (const exc of event.exception.values) {
      if (typeof exc.value === "string") {
        exc.value = truncate(exc.value);
      }
    }
  }

  // Strip text-shaped fields from extras + tags.
  scrubBag(event.extra);
  scrubBag(event.tags);

  // Walk breadcrumbs — recent fetch / console traces — and clean
  // their data payloads.
  if (event.breadcrumbs) {
    for (const bc of event.breadcrumbs) {
      scrubBag(bc.data);
      if (typeof bc.message === "string") {
        bc.message = truncate(bc.message);
      }
    }
  }

  return event;
}
