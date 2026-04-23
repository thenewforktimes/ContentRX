import { describe, it, expect } from "vitest";
import { hashText } from "./log-violations";

describe("hashText", () => {
  it("returns a 64-char hex digest (sha256)", () => {
    expect(hashText("hello")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("is deterministic", () => {
    const s = "Click here to continue";
    expect(hashText(s)).toBe(hashText(s));
  });

  it("distinct inputs produce distinct hashes", () => {
    expect(hashText("Continue")).not.toBe(hashText("continue"));
    expect(hashText("Click here")).not.toBe(hashText("Click here "));
  });

  it("handles utf-8 multi-byte input", () => {
    expect(hashText("café")).toMatch(/^[0-9a-f]{64}$/);
    expect(hashText("🎨 design")).toMatch(/^[0-9a-f]{64}$/);
  });

  it("known vector: sha256('hello') == 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824", () => {
    // A published reference. Pins the digest so a future switch of
    // hashing library or encoding silently breaking the wire format
    // shows up here instead of in production.
    expect(hashText("hello")).toBe(
      "2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824",
    );
  });
});
