/**
 * Server-side Plausible event tracking.
 *
 * Browser pageviews come from the next-plausible <PlausibleProvider> in
 * the root layout. Server-triggered conversion events (signup, upgrade)
 * route through here so they fire reliably from webhook handlers — the
 * client may never have loaded the Plausible script before the event.
 *
 * Locked event names (BUILD_PLAN §13):
 *   signup, upgrade, plugin_install, cli_install, github_action_install
 */

const ENDPOINT = "https://plausible.io/api/event";

type GoalEvent =
  | "signup"
  | "upgrade"
  | "plugin_install"
  | "cli_install"
  | "github_action_install";

export async function trackEvent(
  name: GoalEvent,
  options: {
    /** Sticky identifier for the visitor. Anonymized server-side. */
    userId?: string;
    /** Source URL the action originated from. */
    url?: string;
    /** Forwarded client IP (when called from a webhook receiver). */
    forwardedFor?: string | null;
    /** Custom props sent with the event. */
    props?: Record<string, string | number | boolean>;
  } = {},
): Promise<void> {
  const domain = process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
  if (!domain) {
    // No analytics configured (dev / preview without Plausible). Silent
    // no-op — webhook latency must not depend on analytics.
    return;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": "ContentRX-Server/1.0",
  };
  if (options.forwardedFor) {
    headers["X-Forwarded-For"] = options.forwardedFor;
  }

  const body = {
    name,
    domain,
    url:
      options.url ??
      (process.env.NEXT_PUBLIC_APP_URL
        ? `${process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, "")}/server/${name}`
        : `https://${domain}/server/${name}`),
    props: options.props
      ? Object.fromEntries(
          Object.entries(options.props).map(([k, v]) => [k, String(v)]),
        )
      : undefined,
  };

  try {
    // 5s timeout via AbortController so a slow Plausible response can't
    // stall a webhook past Vercel's function timeout.
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 5000);
    await fetch(ENDPOINT, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    clearTimeout(timeout);
  } catch (err) {
    // Analytics failures must never bubble. Log + move on.
    console.warn(`Plausible trackEvent("${name}") failed`, err);
  }
}
