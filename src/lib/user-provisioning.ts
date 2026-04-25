/**
 * Lazy user provisioning for Clerk-authenticated requests.
 *
 * Background. The Clerk webhook (POST /api/webhooks/clerk) is the
 * canonical place we materialize a Clerk identity into a `users` row.
 * In healthy operation the webhook fires within a second of sign-up and
 * the user lands on /dashboard with their row already present.
 *
 * In practice that's not always true:
 *   - The webhook can be paused, mis-configured, or dropping retries
 *     (incident on 2026-04-25: dedupe race silently dropped a Clerk
 *     retry, no users row ever got created, dashboard dead-ended).
 *   - Webhook delivery has latency. A user can hit /dashboard before
 *     the POST lands.
 *   - Clerk's Backend API has eventual consistency. Immediately after
 *     sign-up, `clerkClient.users.getUser(id)` may 404 for a moment
 *     before the new user is visible to the admin API.
 *   - In dev, webhooks aren't wired at all unless you tunnel with
 *     `svix listen` / ngrok.
 *
 * `getOrProvisionUser` mirrors the lazy-provision pattern in
 * /auth/figma-callback (`ensureApiKey`): look up by clerkId, and if
 * missing, materialize a minimal row from Clerk's user record. Any
 * failure in the provisioning path (Clerk API hiccup, transient DB
 * error) is logged and returns `null` rather than throwing — the
 * caller is expected to render a "we're finishing setting up your
 * account, refresh in a moment" placeholder, which gives the webhook
 * (and Clerk's Backend API) a beat to catch up. This avoids the
 * global-error-boundary crash from the post-PR-#108 rollout.
 */

import { clerkClient } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";

export type ProvisionedUser = typeof schema.users.$inferSelect;

async function primaryEmailFromClerk(clerkId: string): Promise<string | null> {
  try {
    const client = await clerkClient();
    const user = await client.users.getUser(clerkId);
    const primaryId = user.primaryEmailAddressId;
    const primary = user.emailAddresses.find((e) => e.id === primaryId);
    return (primary ?? user.emailAddresses[0])?.emailAddress ?? null;
  } catch (err) {
    console.error(
      `getOrProvisionUser: clerkClient.users.getUser failed for ${clerkId}`,
      err,
    );
    return null;
  }
}

/**
 * Resolve a Clerk ID to its `users` row. If the row is missing, try to
 * materialize one from Clerk's user record. Returns `null` on any
 * provisioning failure so the caller can render a graceful placeholder
 * instead of crashing into the global error boundary.
 *
 * Concurrent provisions from a webhook + a dashboard load race safely
 * via `onConflictDoNothing` on `users.clerk_id`.
 */
export async function getOrProvisionUser(
  clerkId: string,
): Promise<ProvisionedUser | null> {
  const db = getDb();

  try {
    const [existing] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.clerkId, clerkId))
      .limit(1);
    if (existing) return existing;
  } catch (err) {
    console.error(
      `getOrProvisionUser: initial select failed for ${clerkId}`,
      err,
    );
    return null;
  }

  const email = await primaryEmailFromClerk(clerkId);
  if (!email) {
    // Clerk admin API didn't give us an email (eventual consistency,
    // network blip, or user record genuinely has none). Don't insert
    // a placeholder address — the email column has a UNIQUE constraint
    // and the synthetic value would block a legitimate later insert
    // for the real address. Fall through to the placeholder UI.
    return null;
  }

  try {
    // No target on the conflict clause — `users` has unique constraints
    // on both `clerk_id` and `email`. Targeting only clerk_id (as the
    // earlier code did) caused PostgresError: users_email_unique to
    // bubble up when (a) the webhook had already inserted the row and
    // we lost a select-then-insert race, or (b) a stale row with this
    // email existed under a different clerk_id (e.g., from a prior
    // test signup). Bare onConflictDoNothing() lets either conflict
    // pass; the re-select below tells us whether a row now exists for
    // *our* clerk_id.
    await db
      .insert(schema.users)
      .values({ clerkId, email, plan: "free" })
      .onConflictDoNothing();

    const [row] = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.clerkId, clerkId))
      .limit(1);
    return row ?? null;
  } catch (err) {
    console.error(
      `getOrProvisionUser: insert/re-select failed for ${clerkId}`,
      err,
    );
    return null;
  }
}
