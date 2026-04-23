import { describe, it, expect } from "vitest";
import {
  FIGMA_HANDOFF_REDIS_PREFIX,
  FIGMA_HANDOFF_REGEX,
  FIGMA_HANDOFF_TTL_SECONDS,
  isValidHandoff,
} from "./figma-handoff";

describe("figma-handoff", () => {
  describe("isValidHandoff", () => {
    it("accepts a 32-char base64url-style string", () => {
      const code = "aGVsbG9fd29ybGRfaGVsbG9fd29ybGQtMTIz"; // 36 chars, base64url
      expect(isValidHandoff(code)).toBe(true);
    });

    it("accepts the shortest legal form (16 chars)", () => {
      expect(isValidHandoff("a".repeat(16))).toBe(true);
    });

    it("rejects inputs shorter than 16 chars", () => {
      expect(isValidHandoff("a".repeat(15))).toBe(false);
      expect(isValidHandoff("")).toBe(false);
    });

    it("rejects inputs longer than 128 chars", () => {
      expect(isValidHandoff("a".repeat(129))).toBe(false);
    });

    it("rejects disallowed characters", () => {
      expect(isValidHandoff("hello+world/hello1234")).toBe(false); // + / are base64 not base64url
      expect(isValidHandoff("handoff with spaces")).toBe(false);
      expect(isValidHandoff("hello.world.hello.world")).toBe(false);
      expect(isValidHandoff("foo\n\tbar_handoff")).toBe(false);
    });

    it("rejects null and undefined", () => {
      expect(isValidHandoff(null)).toBe(false);
      expect(isValidHandoff(undefined)).toBe(false);
    });

    it("narrows the type guard on truthy return", () => {
      const handoff: string | null = "a".repeat(20);
      if (isValidHandoff(handoff)) {
        // TypeScript should have narrowed this to string.
        const length: number = handoff.length;
        expect(length).toBe(20);
      } else {
        throw new Error("unexpectedly invalid");
      }
    });
  });

  describe("constants", () => {
    it("TTL is 5 minutes", () => {
      expect(FIGMA_HANDOFF_TTL_SECONDS).toBe(300);
    });

    it("Redis prefix is namespaced", () => {
      expect(FIGMA_HANDOFF_REDIS_PREFIX).toBe("figma_handoff:");
    });

    it("regex is conservative (allows only base64url chars)", () => {
      expect(FIGMA_HANDOFF_REGEX.source).toBe("^[A-Za-z0-9_-]{16,128}$");
    });
  });
});
