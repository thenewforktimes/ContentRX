import { describe, it, expect } from "vitest";
import {
  API_KEY_PREFIX_LENGTH,
  API_KEY_REGEX,
  apiKeyPrefix,
  generateApiKey,
  hashApiKey,
  isWellFormedApiKey,
} from "./api-key";

describe("api-key", () => {
  describe("generateApiKey", () => {
    it("starts with cx_", () => {
      expect(generateApiKey()).toMatch(/^cx_/);
    });

    it("matches the well-formed regex", () => {
      const key = generateApiKey();
      expect(API_KEY_REGEX.test(key)).toBe(true);
    });

    it("produces a unique value on every call", () => {
      const a = generateApiKey();
      const b = generateApiKey();
      expect(a).not.toBe(b);
    });
  });

  describe("hashApiKey", () => {
    it("returns a 64-character hex digest (sha256)", () => {
      const hash = hashApiKey("cx_abc123def456789");
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it("is deterministic — same input yields same hash", () => {
      const key = "cx_deadbeef12345678";
      expect(hashApiKey(key)).toBe(hashApiKey(key));
    });

    it("distinct inputs produce distinct hashes", () => {
      expect(hashApiKey("cx_aaa111111111aaaa")).not.toBe(hashApiKey("cx_bbb222222222bbbb"));
    });
  });

  describe("apiKeyPrefix", () => {
    it("returns exactly API_KEY_PREFIX_LENGTH chars", () => {
      const prefix = apiKeyPrefix("cx_ABCDEFGHIJKLMNOP");
      expect(prefix.length).toBe(API_KEY_PREFIX_LENGTH);
      expect(prefix).toBe("cx_ABCDEFGHI");
    });
  });

  describe("isWellFormedApiKey", () => {
    it("accepts a generated key", () => {
      expect(isWellFormedApiKey(generateApiKey())).toBe(true);
    });

    it("rejects keys without the cx_ prefix", () => {
      expect(isWellFormedApiKey("sk_abcdefghijklmnop")).toBe(false);
      expect(isWellFormedApiKey("abcdefghijklmnopqr")).toBe(false);
    });

    it("rejects keys shorter than the minimum body length", () => {
      expect(isWellFormedApiKey("cx_short")).toBe(false);
      expect(isWellFormedApiKey("cx_")).toBe(false);
    });

    it("rejects keys with disallowed characters", () => {
      // cuid2 uses [a-z0-9] but the regex allows [A-Za-z0-9]; still no dashes/spaces/etc.
      expect(isWellFormedApiKey("cx_hello-world-12345")).toBe(false);
      expect(isWellFormedApiKey("cx_hello world12345")).toBe(false);
      expect(isWellFormedApiKey("cx_hello.world.12345")).toBe(false);
    });
  });
});
