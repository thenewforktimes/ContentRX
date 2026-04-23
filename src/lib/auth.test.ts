import { describe, it, expect } from "vitest";
import { parseBearerToken } from "./auth";

describe("parseBearerToken", () => {
  it("returns null for no header", () => {
    expect(parseBearerToken(null)).toBeNull();
    expect(parseBearerToken("")).toBeNull();
  });

  it("returns null for non-Bearer auth schemes", () => {
    expect(parseBearerToken("Basic dXNlcjpwYXNz")).toBeNull();
    expect(parseBearerToken("Digest foo=bar")).toBeNull();
  });

  it("returns null for Bearer tokens that don't start with cx_", () => {
    // Clerk session JWT starts with 'eyJ...' — should NOT be treated as our API key
    expect(parseBearerToken("Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjM0")).toBeNull();
    // Other services
    expect(parseBearerToken("Bearer sk_test_abc123")).toBeNull();
    expect(parseBearerToken("Bearer Bearer cx_abc")).toBeNull(); // literal "Bearer cx_abc" after Bearer — not prefixed cx_
  });

  it("extracts a cx_... token from a Bearer header", () => {
    expect(parseBearerToken("Bearer cx_abc123def456")).toBe("cx_abc123def456");
  });

  it("accepts case-insensitive scheme", () => {
    expect(parseBearerToken("bearer cx_abc123def456")).toBe("cx_abc123def456");
    expect(parseBearerToken("BEARER cx_abc123def456")).toBe("cx_abc123def456");
  });

  it("trims leading/trailing whitespace inside the token", () => {
    expect(parseBearerToken("Bearer   cx_abc123def456   ")).toBe("cx_abc123def456");
  });

  it("tolerates multiple spaces between scheme and token", () => {
    expect(parseBearerToken("Bearer   cx_abc123def456")).toBe("cx_abc123def456");
  });
});
