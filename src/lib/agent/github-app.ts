/**
 * ContentRX GitHub App auth + Octokit factory (Phase G3 follow-up).
 *
 * The weekly review agent's customer-facing delivery is a draft PR
 * opened on a repo the customer has connected via the ContentRX
 * GitHub App. This module owns the auth side of that delivery:
 *   - Loading the App's credentials from env.
 *   - Minting installation-scoped tokens via @octokit/auth-app.
 *   - Verifying webhook signatures with HMAC-SHA256 + constant-time
 *     comparison.
 *
 * The PR-creation logic itself lives in src/lib/agent/open-pr.ts;
 * this file is the auth boundary.
 *
 * Env vars (all required for the surface to activate; the routes
 * fall back gracefully when any are unset so the dashboard can
 * still render the "registration in progress" state):
 *   - GITHUB_APP_ID
 *   - GITHUB_APP_CLIENT_ID
 *   - GITHUB_APP_CLIENT_SECRET
 *   - GITHUB_APP_PRIVATE_KEY        (PEM, may be base64-encoded)
 *   - GITHUB_APP_WEBHOOK_SECRET
 *   - GITHUB_APP_SLUG               (the App's URL slug, used for
 *                                    the install redirect)
 */

import { createAppAuth } from "@octokit/auth-app";
import { request as octokitRequest } from "@octokit/request";
import { createHmac, timingSafeEqual } from "node:crypto";

export type GithubAppConfig = {
  appId: string;
  clientId: string;
  clientSecret: string;
  privateKey: string;
  webhookSecret: string;
  slug: string;
};

/**
 * Read the App config from env. Returns null when any required var is
 * missing — the routes use that signal to render a "GitHub App not
 * yet registered" state instead of throwing.
 */
export function readGithubAppConfig(): GithubAppConfig | null {
  const appId = process.env.GITHUB_APP_ID;
  const clientId = process.env.GITHUB_APP_CLIENT_ID;
  const clientSecret = process.env.GITHUB_APP_CLIENT_SECRET;
  const rawPrivateKey = process.env.GITHUB_APP_PRIVATE_KEY;
  const webhookSecret = process.env.GITHUB_APP_WEBHOOK_SECRET;
  const slug = process.env.GITHUB_APP_SLUG;

  if (
    !appId ||
    !clientId ||
    !clientSecret ||
    !rawPrivateKey ||
    !webhookSecret ||
    !slug
  ) {
    return null;
  }

  // Vercel env doesn't preserve newlines in single-line entries.
  // Two formats are accepted: a base64-encoded PEM (recommended;
  // paste-safe) or a literal PEM with `\n` escape sequences.
  const privateKey = rawPrivateKey.includes("BEGIN")
    ? rawPrivateKey.replace(/\\n/g, "\n")
    : Buffer.from(rawPrivateKey, "base64").toString("utf-8");

  return {
    appId,
    clientId,
    clientSecret,
    privateKey,
    webhookSecret,
    slug,
  };
}

/** Returns true when every required env var is present. The dashboard
 * + connect-flow routes use this to gate the "Connect GitHub" button. */
export function isGithubAppConfigured(): boolean {
  return readGithubAppConfig() !== null;
}

/**
 * Build an octokit `request` instance authenticated as a specific
 * installation. The returned function signs every call with an
 * installation-scoped access token (TTL = ~1h; @octokit/auth-app
 * caches and refreshes automatically).
 */
export function installationRequest(installationId: number) {
  const config = readGithubAppConfig();
  if (!config) {
    throw new Error(
      "GitHub App is not configured. Set GITHUB_APP_* env vars first.",
    );
  }
  const auth = createAppAuth({
    appId: config.appId,
    privateKey: config.privateKey,
    clientId: config.clientId,
    clientSecret: config.clientSecret,
    installationId,
  });
  return octokitRequest.defaults({
    request: {
      hook: auth.hook,
    },
  });
}

/**
 * Verify a webhook delivery signature. GitHub signs every webhook
 * payload with `X-Hub-Signature-256: sha256=<hmac>`; we recompute
 * the HMAC over the raw body and constant-time compare.
 *
 * Returns false when:
 *   - the App isn't configured (no secret to verify against),
 *   - the signature header is missing or malformed,
 *   - the digest doesn't match.
 */
export function verifyWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
): boolean {
  const config = readGithubAppConfig();
  if (!config) return false;
  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
    return false;
  }
  const expected = signatureHeader.slice("sha256=".length);
  const actual = createHmac("sha256", config.webhookSecret)
    .update(rawBody, "utf-8")
    .digest("hex");
  if (expected.length !== actual.length) return false;
  try {
    return timingSafeEqual(
      Buffer.from(expected, "hex"),
      Buffer.from(actual, "hex"),
    );
  } catch {
    return false;
  }
}

/**
 * Build the GitHub install URL the dashboard's "Connect GitHub"
 * button redirects to. The optional `state` is forwarded to the
 * post-install callback so we can identify which ContentRX team the
 * installation belongs to (the GitHub App callback doesn't carry
 * the Clerk session).
 */
export function buildInstallUrl(state: string): string | null {
  const config = readGithubAppConfig();
  if (!config) return null;
  const url = new URL(
    `https://github.com/apps/${config.slug}/installations/new`,
  );
  url.searchParams.set("state", state);
  return url.toString();
}
