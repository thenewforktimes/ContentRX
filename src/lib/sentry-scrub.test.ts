/**
 * Tests for the Sentry beforeSend scrubber.
 *
 * Covers each surface where user content could leak: request body,
 * request headers (authorization + cookie), exception messages,
 * extras, tags, breadcrumbs. The contract under test: after the
 * scrubber runs, the event has no field that contains a customer
 * string verbatim.
 */

import { describe, expect, it } from "vitest";
import { scrubSentryEvent } from "./sentry-scrub";

// Structural Event shape mirroring @sentry/types — kept local so the
// tests don't take a hard dependency on a transitive SDK type.
interface Event {
  message?: string;
  request?: {
    data?: unknown;
    headers?: Record<string, string | string[] | undefined>;
    cookies?: Record<string, string | string[]>;
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

const REAL_USER_TEXT = "John Smith SSN 123-45-6789 logging in";

describe("scrubSentryEvent — request body", () => {
  it("drops event.request.data entirely", () => {
    const event: Event = {
      request: { data: REAL_USER_TEXT },
    };
    const scrubbed = scrubSentryEvent(event);
    expect(scrubbed.request?.data).toBeUndefined();
  });

  it("drops event.request.cookies", () => {
    const event: Event = {
      request: { cookies: { __session: "clerk_session_value" } },
    };
    const scrubbed = scrubSentryEvent(event);
    expect(scrubbed.request?.cookies).toBeUndefined();
  });

  it("drops event.request.query_string (could carry OAuth state)", () => {
    const event: Event = {
      request: { query_string: "handoff=abc123&plugin=1" },
    };
    const scrubbed = scrubSentryEvent(event);
    expect(scrubbed.request?.query_string).toBeUndefined();
  });
});

describe("scrubSentryEvent — request headers", () => {
  it("scrubs Authorization headers", () => {
    const event: Event = {
      request: {
        headers: {
          authorization: "Bearer cx_real_secret_value",
          accept: "application/json",
        },
      },
    };
    const scrubbed = scrubSentryEvent(event);
    expect(scrubbed.request?.headers?.authorization).toBe("[scrubbed]");
    // Non-sensitive headers stay.
    expect(scrubbed.request?.headers?.accept).toBe("application/json");
  });

  it("is case-insensitive on header names", () => {
    const event: Event = {
      request: {
        headers: { Authorization: "Bearer cx_…", Cookie: "__session=…" },
      },
    };
    const scrubbed = scrubSentryEvent(event);
    expect(scrubbed.request?.headers?.Authorization).toBe("[scrubbed]");
    expect(scrubbed.request?.headers?.Cookie).toBe("[scrubbed]");
  });

  it("scrubs the internal-eval secret if it ever leaks into Sentry", () => {
    const event: Event = {
      request: { headers: { "x-internal-secret": "real_secret" } },
    };
    const scrubbed = scrubSentryEvent(event);
    expect(scrubbed.request?.headers?.["x-internal-secret"]).toBe(
      "[scrubbed]",
    );
  });
});

describe("scrubSentryEvent — exception messages", () => {
  it("truncates top-level message past 200 chars", () => {
    const long = "a".repeat(500);
    const event: Event = { message: long };
    const scrubbed = scrubSentryEvent(event);
    expect(scrubbed.message).toMatch(/\[truncated\]$/);
    expect((scrubbed.message as string).length).toBeLessThanOrEqual(220);
  });

  it("truncates each exception value past 200 chars", () => {
    const longValue = "ParseError: " + "x".repeat(500);
    const event: Event = {
      exception: { values: [{ type: "ParseError", value: longValue }] },
    };
    const scrubbed = scrubSentryEvent(event);
    const value = scrubbed.exception?.values?.[0]?.value ?? "";
    expect(value).toMatch(/\[truncated\]$/);
    expect(value.length).toBeLessThanOrEqual(220);
  });

  it("leaves short messages alone", () => {
    const event: Event = { message: "Short error" };
    const scrubbed = scrubSentryEvent(event);
    expect(scrubbed.message).toBe("Short error");
  });
});

describe("scrubSentryEvent — extras + tags + breadcrumbs", () => {
  it("redacts text-shaped extras", () => {
    const event: Event = {
      extra: { text: REAL_USER_TEXT, latency: 123, content: "more text" },
    };
    const scrubbed = scrubSentryEvent(event);
    expect(scrubbed.extra?.text).toBe("[scrubbed]");
    expect(scrubbed.extra?.content).toBe("[scrubbed]");
    // Non-content extras stay.
    expect(scrubbed.extra?.latency).toBe(123);
  });

  it("redacts text-shaped tags", () => {
    const event: Event = {
      tags: { body: REAL_USER_TEXT, route: "/api/check" },
    };
    const scrubbed = scrubSentryEvent(event);
    expect(scrubbed.tags?.body).toBe("[scrubbed]");
    expect(scrubbed.tags?.route).toBe("/api/check");
  });

  it("scrubs breadcrumb data + truncates breadcrumb messages", () => {
    const long = "x".repeat(400);
    const event: Event = {
      breadcrumbs: [
        {
          category: "fetch",
          data: { input: REAL_USER_TEXT, status: 500 },
          message: long,
        },
      ],
    };
    const scrubbed = scrubSentryEvent(event);
    const bc = scrubbed.breadcrumbs?.[0];
    expect(bc?.data?.input).toBe("[scrubbed]");
    expect(bc?.data?.status).toBe(500);
    expect(bc?.message).toMatch(/\[truncated\]$/);
  });

  it("is case-insensitive on extras keys", () => {
    const event: Event = {
      extra: { Text: REAL_USER_TEXT, BODY: REAL_USER_TEXT },
    };
    const scrubbed = scrubSentryEvent(event);
    expect(scrubbed.extra?.Text).toBe("[scrubbed]");
    expect(scrubbed.extra?.BODY).toBe("[scrubbed]");
  });
});

describe("scrubSentryEvent — does NOT drop the event", () => {
  it("returns the event even when nothing matches", () => {
    const event: Event = {
      message: "Clean error",
      tags: { route: "/api/check" },
    };
    const scrubbed = scrubSentryEvent(event);
    expect(scrubbed).toBe(event);
  });
});
