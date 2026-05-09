import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHmac } from "node:crypto";
import {
  buildInstallUrl,
  isGithubAppConfigured,
  readGithubAppConfig,
  verifyWebhookSignature,
} from "./github-app";

/**
 * GitHub App auth-helpers tests (Phase G3 follow-up).
 *
 * Pure-logic coverage: env loading, signature verification, install
 * URL construction. The Octokit-backed installationRequest function
 * isn't tested here (it talks to GitHub's actual auth endpoint when
 * minting tokens; we mock it where it's used in the cron + open-pr
 * tests instead).
 */

const ORIGINAL_ENV = { ...process.env };
const FIXTURE_PRIVATE_KEY_PEM = `-----BEGIN RSA PRIVATE KEY-----
MIIBOgIBAAJBAKj34GkxFhD90vcNLYLInFEX6Ppy1tPf9Cnzj4p4WGeKLs1Pt8Qu
KUpRKfFLfRYC9AIKjbJTWit+CqvjWYzvQwECAwEAAQJAIJLixBy2qpFoS4DSmoEm
o3qGy0t6z09AIJtH+5OeRV1be+N4cDYJKffGzDa88vQENZiRm0GRq6a+HPGQMd2k
TQIhAKMSvzIBnni7ot/OSie2TmJLY4SwTQAevXysE2RbFDYdAiEBCUEaRQnMnbp7
9mxDXDf6AU0cN/RPBjb9qSHDcWZHGzUCIG2Es59z8ugGrDY+pxLQnwfotadxd+Uy
v/Ow5T0q5gIJAiEAyS4RaI9YG8EWx/2w0T67ZUVAw8eOMB6BIUg0Xcu+3okCIBOs
/5OiPgoTdSy7bcF9IGpSE8ZgGKzgYQVZeN97YE00
-----END RSA PRIVATE KEY-----`;

const FULL_CONFIG = {
  GITHUB_APP_ID: "123456",
  GITHUB_APP_CLIENT_ID: "Iv1.fakefakefakefake",
  GITHUB_APP_CLIENT_SECRET: "shhhhhsecret",
  GITHUB_APP_PRIVATE_KEY: FIXTURE_PRIVATE_KEY_PEM,
  GITHUB_APP_WEBHOOK_SECRET: "webhook-shhh",
  GITHUB_APP_SLUG: "contentrx-agent",
} as const;

beforeEach(() => {
  // Strip any GITHUB_APP_* var from process.env so each test
  // starts from a clean slate.
  for (const key of Object.keys(process.env)) {
    if (key.startsWith("GITHUB_APP_")) delete process.env[key];
  }
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("readGithubAppConfig", () => {
  it("returns null when any required env var is missing", () => {
    expect(readGithubAppConfig()).toBeNull();
  });

  it("returns null when only some vars are set", () => {
    process.env.GITHUB_APP_ID = "123";
    expect(readGithubAppConfig()).toBeNull();
  });

  it("returns the config when every required var is present", () => {
    Object.assign(process.env, FULL_CONFIG);
    const cfg = readGithubAppConfig();
    expect(cfg).not.toBeNull();
    expect(cfg!.appId).toBe("123456");
    expect(cfg!.privateKey).toContain("BEGIN RSA PRIVATE KEY");
  });

  it("decodes a base64-encoded PEM private key", () => {
    Object.assign(process.env, FULL_CONFIG);
    process.env.GITHUB_APP_PRIVATE_KEY = Buffer.from(
      FIXTURE_PRIVATE_KEY_PEM,
      "utf-8",
    ).toString("base64");
    const cfg = readGithubAppConfig();
    expect(cfg).not.toBeNull();
    expect(cfg!.privateKey).toContain("BEGIN RSA PRIVATE KEY");
  });

  it("unescapes \\n in a literal-PEM env value (Vercel single-line edge case)", () => {
    Object.assign(process.env, FULL_CONFIG);
    process.env.GITHUB_APP_PRIVATE_KEY =
      "-----BEGIN RSA PRIVATE KEY-----\\nMII...\\n-----END RSA PRIVATE KEY-----";
    const cfg = readGithubAppConfig();
    expect(cfg).not.toBeNull();
    // Real newlines, not escape sequences.
    expect(cfg!.privateKey).toContain("\n");
    expect(cfg!.privateKey).not.toContain("\\n");
  });
});

describe("isGithubAppConfigured", () => {
  it("returns false with no env", () => {
    expect(isGithubAppConfigured()).toBe(false);
  });

  it("returns true with full env", () => {
    Object.assign(process.env, FULL_CONFIG);
    expect(isGithubAppConfigured()).toBe(true);
  });
});

describe("buildInstallUrl", () => {
  it("returns null when not configured", () => {
    expect(buildInstallUrl("team-1")).toBeNull();
  });

  it("includes the slug + state parameter", () => {
    Object.assign(process.env, FULL_CONFIG);
    const url = buildInstallUrl("team-abc-123");
    expect(url).not.toBeNull();
    expect(url).toContain("github.com/apps/contentrx-agent/installations/new");
    expect(url).toContain("state=team-abc-123");
  });
});

describe("verifyWebhookSignature", () => {
  it("returns false when GitHub App is not configured", () => {
    expect(verifyWebhookSignature("body", "sha256=abc")).toBe(false);
  });

  it("returns false when signature header is missing", () => {
    Object.assign(process.env, FULL_CONFIG);
    expect(verifyWebhookSignature("body", null)).toBe(false);
  });

  it("returns false when signature header is malformed (no sha256= prefix)", () => {
    Object.assign(process.env, FULL_CONFIG);
    expect(verifyWebhookSignature("body", "abcdef")).toBe(false);
  });

  it("returns false when the digest doesn't match", () => {
    Object.assign(process.env, FULL_CONFIG);
    expect(
      verifyWebhookSignature(
        "body",
        "sha256=0000000000000000000000000000000000000000000000000000000000000000",
      ),
    ).toBe(false);
  });

  it("returns true on a correctly-signed body", () => {
    Object.assign(process.env, FULL_CONFIG);
    const body = '{"action":"created","installation":{"id":42}}';
    const sig = createHmac("sha256", FULL_CONFIG.GITHUB_APP_WEBHOOK_SECRET)
      .update(body, "utf-8")
      .digest("hex");
    expect(verifyWebhookSignature(body, `sha256=${sig}`)).toBe(true);
  });

  it("rejects a signature signed with the wrong secret", () => {
    Object.assign(process.env, FULL_CONFIG);
    const body = '{"action":"created"}';
    const wrongSig = createHmac("sha256", "different-secret")
      .update(body, "utf-8")
      .digest("hex");
    expect(verifyWebhookSignature(body, `sha256=${wrongSig}`)).toBe(false);
  });

  it("uses constant-time comparison (no length-based early exit revealing partial match)", () => {
    Object.assign(process.env, FULL_CONFIG);
    // Same length as a real sha256 hex (64 chars), all zeros.
    const fakeSig = "0".repeat(64);
    const result = verifyWebhookSignature("body", `sha256=${fakeSig}`);
    expect(result).toBe(false);
  });
});
