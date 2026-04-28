/**
 * Tests for `logSafeError`.
 *
 * The contract: console.error gets called with a label and a
 * structured payload — never with the err object directly. The
 * payload carries the error type, a truncated message, an HTTP
 * status when present, and an opt-in truncated stack. Whatever else
 * was hanging off the err object (a `.cause` chain, a `.request`
 * snapshot, the SDK's serialised payload) does NOT make it into the
 * log line.
 */

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";
import { logSafeError } from "./safe-error-log";

let consoleSpy: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleSpy.mockRestore();
});

describe("logSafeError — Error subclasses", () => {
  it("logs kind and message for a plain Error", () => {
    logSafeError("evaluate failed", new Error("something went wrong"));
    expect(consoleSpy).toHaveBeenCalledWith("evaluate failed", {
      kind: "Error",
      message: "something went wrong",
    });
  });

  it("uses the error's constructor name as kind", () => {
    class ParseError extends Error {}
    logSafeError("parse failed", new ParseError("bad json"));
    expect(consoleSpy).toHaveBeenCalledWith("parse failed", {
      kind: "ParseError",
      message: "bad json",
    });
  });

  it("includes status when the error carries one (Stripe / fetch shape)", () => {
    const err = Object.assign(new Error("Upstream 502"), { status: 502 });
    logSafeError("upstream fail", err);
    expect(consoleSpy).toHaveBeenCalledWith("upstream fail", {
      kind: "Error",
      message: "Upstream 502",
      status: 502,
    });
  });

  it("truncates messages past 200 chars", () => {
    const long = "x".repeat(400);
    logSafeError("noisy err", new Error(long));
    const [, payload] = consoleSpy.mock.calls[0] as [
      string,
      { message: string },
    ];
    expect(payload.message?.endsWith("…")).toBe(true);
    expect(payload.message?.length).toBeLessThanOrEqual(201);
  });

  it("does NOT include the stack by default", () => {
    logSafeError("err", new Error("boom"));
    const [, payload] = consoleSpy.mock.calls[0] as [
      string,
      { stack?: string },
    ];
    expect(payload.stack).toBeUndefined();
  });

  it("includes the first 3 stack frames when includeStack=true", () => {
    const err = new Error("boom");
    err.stack = "Error: boom\n    at one\n    at two\n    at three\n    at four";
    logSafeError("err", err, { includeStack: true });
    const [, payload] = consoleSpy.mock.calls[0] as [
      string,
      { stack: string },
    ];
    const frames = payload.stack.split("\n");
    expect(frames).toHaveLength(3);
    expect(frames[0]).toContain("boom");
  });
});

describe("logSafeError — non-Error inputs", () => {
  it("handles a thrown string", () => {
    logSafeError("string thrown", "boom");
    expect(consoleSpy).toHaveBeenCalledWith("string thrown", {
      kind: "string",
      message: "boom",
    });
  });

  it("handles a thrown number", () => {
    logSafeError("number thrown", 42);
    expect(consoleSpy).toHaveBeenCalledWith("number thrown", {
      kind: "number",
      message: "42",
    });
  });

  it("handles undefined / null", () => {
    logSafeError("nothing thrown", null);
    expect(consoleSpy).toHaveBeenCalledWith("nothing thrown", {
      kind: "object",
      message: "null",
    });
  });
});

describe("logSafeError — never leaks transitive err properties", () => {
  it("does NOT serialise the err object's other fields", () => {
    // SDK errors often carry a `.request` or `.response` field with
    // the raw payload. Make sure none of that shows up in the log.
    const err = Object.assign(new Error("upstream failed"), {
      status: 502,
      request: { body: "John Smith SSN 123-45-6789" },
      response: { headers: { authorization: "Bearer cx_real" } },
    });
    logSafeError("upstream fail", err);
    const [, payload] = consoleSpy.mock.calls[0] as [string, unknown];
    const json = JSON.stringify(payload);
    expect(json).not.toContain("123-45-6789");
    expect(json).not.toContain("cx_real");
    expect(json).not.toContain("request");
    expect(json).not.toContain("response");
  });
});
