import { describe, it, expect } from "vitest";
import { envelope, SCHEMA_VERSION } from "./api-envelope";

describe("api-envelope", () => {
  it("attaches schema_version and empty warnings by default", () => {
    const out = envelope({ result: { ok: true } });
    expect(out.schema_version).toBe(SCHEMA_VERSION);
    expect(out.warnings).toEqual([]);
    expect(out.result).toEqual({ ok: true });
  });

  it("passes through warnings when provided", () => {
    const out = envelope({ result: { x: 1 } }, { warnings: ["deprecated"] });
    expect(out.warnings).toEqual(["deprecated"]);
  });

  it("does not clobber existing fields in the payload", () => {
    const out = envelope({ a: 1, b: "two", c: [3] });
    expect(out.a).toBe(1);
    expect(out.b).toBe("two");
    expect(out.c).toEqual([3]);
    expect(out.schema_version).toBe(SCHEMA_VERSION);
  });

  it("SCHEMA_VERSION is valid semver", () => {
    expect(SCHEMA_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
  });
});
