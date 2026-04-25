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
 *   - In dev, webhooks aren't wired at all unless you tunnel with
 *     `svix listen` / ngrok.
 *
 * `getOrProvisionUser` mirrors the lazy-provision pattern already in
 * /auth/figma-callback (`ensureApiKey`): look up by clerkId, and if
 * missing, materialize a minimal row from Clerk's user record. The
 * insert is `onConflictDoNothing` so concurrent provisions from a
 * webhook + a dashboard load can race safely.
 */

import { clerkClient } from "@clerk/nextjs/server";
import { eq } from "drizzle-orm";
import { getDb, schema } from "@/db";

export type ProvisionedUser = typeof schema.users.$inferSelect;

async function primaryEmailFromClerk(clerkId: string): Promise<string> {
  const client = await clerkClient();
  const user = await client.users.getUser(clerkId);
  const primaryId = user.primaryEmailAddressId;
  const primary = user.emailAddresses.find((e) => e.id === primaryId);
  const email = (primary ?? user.emailAddresses[0])?.emailAddress;
  // The webhook handler returns 400 when there's no email. Match that
  // behavior by synthesizing a placeholder so the row at least exists;
  // the user can complete their email in Clerk and a future
  // `user.updated` webhook will reconcile.
  return email ?? `${clerkId}@unknown.local`;
}

/**
 * Resolve a Clerk ID to its `users` row, creating the row if the
 * webhook hasn't materialized it yet. Safe to call from any Server
 * Component or Route Handler that holds a Clerk session.
 *
 * Throws only if the Clerk lookup itself fails (network error talking
 * to Clerk's API). Concurrent provisions from competing callers are
 * safe via `onConflictDoNothing` on `users.clerk_id`.
 */
export async function getOrProvisionUser(
  clerkId: string,
): Promise<ProvisionedUser> {
  const db = getDb();

  let [row] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.clerkId, clerkId))
    .limit(1);

  if (row) return row;

  const email = await primaryEmailFromClerk(clerkId);
  await db
    .insert(schema.users)
    .values({ clerkId, email, plan: "free" })
    .onConflictDoNothing({ target: schema.users.clerkId });

  [row] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.clerkId, clerkId))
    .limit(1);

  if (!row) {
    // Should be unreachable: the insert is idempotent and we just
    // selected after it. If it does happen, surface a typed error
    // instead of pretending we have a row.
    throw new Error(`Failed to provision user for clerk_id ${clerkId}`);
  }

  return row;
}
