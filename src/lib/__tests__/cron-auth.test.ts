import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { requireCronAuth } from "../cron-auth";

const SECRET = "abc123-very-secret-token";

function reqWith(headers: Record<string, string>): Request {
  return new Request("https://example.com/api/cron/test", { headers });
}

describe("requireCronAuth", () => {
  const originalEnv = process.env;
  beforeEach(() => {
    process.env = { ...originalEnv, CRON_SECRET: SECRET };
  });
  afterEach(() => {
    process.env = originalEnv;
  });

  it("returns null on a valid Bearer token", async () => {
    const req = reqWith({ authorization: `Bearer ${SECRET}` });
    expect(requireCronAuth(req)).toBeNull();
  });

  it("returns 401 when Authorization header is missing", async () => {
    const res = requireCronAuth(reqWith({}));
    expect(res?.status).toBe(401);
  });

  it("returns 401 when Authorization is not Bearer-prefixed", async () => {
    const res = requireCronAuth(reqWith({ authorization: SECRET }));
    expect(res?.status).toBe(401);
  });

  it("returns 401 when token is wrong", async () => {
    const res = requireCronAuth(reqWith({ authorization: "Bearer wrong-token" }));
    expect(res?.status).toBe(401);
  });

  it("returns 401 when token is shorter than expected (length-leak guard)", async () => {
    // The constant-time compare requires equal-length buffers; differing
    // lengths short-circuit BEFORE timingSafeEqual is called, but still
    // return the same 401 (same body) so the response shape doesn't leak
    // length information.
    const res = requireCronAuth(reqWith({ authorization: "Bearer short" }));
    expect(res?.status).toBe(401);
  });

  it("returns 401 when token is longer than expected", async () => {
    const res = requireCronAuth(
      reqWith({ authorization: `Bearer ${SECRET}-extra` }),
    );
    expect(res?.status).toBe(401);
  });

  it("accepts case-insensitive Bearer keyword", async () => {
    expect(requireCronAuth(reqWith({ authorization: `bearer ${SECRET}` }))).toBeNull();
    expect(requireCronAuth(reqWith({ authorization: `BEARER ${SECRET}` }))).toBeNull();
  });

  it("trims whitespace around the token", async () => {
    const req = reqWith({ authorization: `Bearer   ${SECRET}   ` });
    expect(requireCronAuth(req)).toBeNull();
  });

  it("throws (via requireEnv) when CRON_SECRET is unset", async () => {
    delete process.env.CRON_SECRET;
    expect(() => requireCronAuth(reqWith({ authorization: `Bearer ${SECRET}` }))).toThrow(
      /CRON_SECRET/,
    );
  });

  it("throws when CRON_SECRET is empty string (the actual env-var bug class)", async () => {
    process.env.CRON_SECRET = "";
    expect(() => requireCronAuth(reqWith({ authorization: `Bearer ${SECRET}` }))).toThrow(
      /CRON_SECRET/,
    );
  });

  it("returns 401 (not 200) when an attacker tries the empty-string compare attack", async () => {
    // If we used non-constant-time compare against an empty expected,
    // an empty token would match. CRON_SECRET is set to a real value
    // here, so the empty token must be rejected.
    const res = requireCronAuth(reqWith({ authorization: "Bearer " }));
    expect(res?.status).toBe(401);
  });
});
