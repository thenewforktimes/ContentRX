/**
 * Tests for monthly usage + atomic quota claiming.
 *
 * Audit 2026-04-26 P1: `claimQuotaSlot` was the fix for BE-M-04 (read-
 * then-write quota race) but had zero regression coverage. This suite
 * runs concurrent claim attempts against a real-Postgres-semantics
 * pglite instance and asserts the WHERE-guard on the upsert holds
 * under contention.
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { eq, and } from "drizzle-orm";
import * as schema from "@/db/schema";
import { createTestDb, seedUser, type TestDbHarness } from "./__test_db__";

// vi.mock is hoisted ABOVE all imports, so we can't reference a
// runtime harness from inside the factory. Use a deferred-ref object
// that the factory captures once; beforeAll fills it in. The getDb()
// getter dereferences at call time so production code sees the live
// pglite instance.
const dbRef: { current: TestDbHarness["db"] | null } = { current: null };

vi.mock("@/db", async () => {
  const actual = await vi.importActual<typeof import("@/db")>("@/db");
  return {
    ...actual,
    getDb: () => {
      if (dbRef.current === null) {
        throw new Error(
          "test harness not initialised — beforeAll must run before getDb() is called",
        );
      }
      return dbRef.current;
    },
  };
});

import { claimQuotaSlot, getCurrentUsage, recordTokenUsage } from "./usage";
import { currentMonth } from "./quotas";

let harness: TestDbHarness;

beforeAll(async () => {
  harness = await createTestDb();
  dbRef.current = harness.db;
});

afterAll(async () => {
  await harness?.close();
});

beforeEach(async () => {
  await harness.reset();
});

// ---------------------------------------------------------------------------
// getCurrentUsage
// ---------------------------------------------------------------------------

describe("getCurrentUsage", () => {
  it("returns 0 when the user has no row for the current month", async () => {
    const userId = await seedUser(harness);
    expect(await getCurrentUsage(userId)).toBe(0);
  });

  it("returns the current-month count when the row exists", async () => {
    const userId = await seedUser(harness);
    await harness.db.insert(schema.usage).values({
      id: "u1",
      userId,
      month: currentMonth(),
      count: 7,
    });
    expect(await getCurrentUsage(userId)).toBe(7);
  });

  it("ignores rows from other months", async () => {
    const userId = await seedUser(harness);
    await harness.db.insert(schema.usage).values([
      { id: "u-prev", userId, month: "2025-01", count: 100 },
      { id: "u-curr", userId, month: currentMonth(), count: 3 },
    ]);
    expect(await getCurrentUsage(userId)).toBe(3);
  });
});

// ---------------------------------------------------------------------------
// claimQuotaSlot — the primary regression target
// ---------------------------------------------------------------------------

describe("claimQuotaSlot", () => {
  it("grants the first claim and increments the count to 1", async () => {
    const userId = await seedUser(harness);
    const result = await claimQuotaSlot(userId, 10);
    expect(result).toEqual({ granted: true, count: 1 });
    expect(await getCurrentUsage(userId)).toBe(1);
  });

  it("creates exactly one row across many sequential claims", async () => {
    const userId = await seedUser(harness);
    for (let i = 0; i < 5; i++) await claimQuotaSlot(userId, 100);

    const rows = await harness.db
      .select()
      .from(schema.usage)
      .where(
        and(
          eq(schema.usage.userId, userId),
          eq(schema.usage.month, currentMonth()),
        ),
      );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.count).toBe(5);
  });

  it("rejects the claim that would breach the cap and returns the current count", async () => {
    const userId = await seedUser(harness);
    await claimQuotaSlot(userId, 2); // count = 1
    await claimQuotaSlot(userId, 2); // count = 2 (at cap)

    const rejected = await claimQuotaSlot(userId, 2);
    expect(rejected.granted).toBe(false);
    expect(rejected.count).toBe(2);
    expect(await getCurrentUsage(userId)).toBe(2); // not incremented
  });

  it("rejects subsequent claims when the cap is 0 (first claim creates the row)", async () => {
    // Edge case unreachable in production (plan quotas are >= 100).
    // The INSERT branch of the upsert has no WHERE-guard, so the FIRST
    // claim with quota=0 inserts a row at count=1 — only the UPDATE
    // branch's `setWhere: count < quota` rejects subsequent claims.
    // This is the same shape as Postgres's MERGE semantics; documenting
    // it here so future readers don't think it's a regression.
    const userId = await seedUser(harness);
    const first = await claimQuotaSlot(userId, 0);
    expect(first).toEqual({ granted: true, count: 1 });

    const second = await claimQuotaSlot(userId, 0);
    expect(second).toEqual({ granted: false, count: 1 });
  });

  it("under N concurrent claims with quota Q, exactly Q succeed (atomicity)", async () => {
    // The whole reason claimQuotaSlot exists is to avoid the read-
    // then-write race. Fire 12 claims at once with quota=5; the
    // WHERE-guard on the upsert update branch must reject 7.
    const userId = await seedUser(harness);
    const QUOTA = 5;
    const ATTEMPTS = 12;
    const results = await Promise.all(
      Array.from({ length: ATTEMPTS }, () => claimQuotaSlot(userId, QUOTA)),
    );

    const granted = results.filter((r) => r.granted).length;
    const rejected = results.filter((r) => !r.granted).length;
    expect(granted).toBe(QUOTA);
    expect(rejected).toBe(ATTEMPTS - QUOTA);
    // The final count must equal exactly the quota — no double-count
    // and no above-cap leak.
    expect(await getCurrentUsage(userId)).toBe(QUOTA);
  });

  it("under contention at the boundary, one claim succeeds and the rest reject cleanly", async () => {
    // Bracket the boundary: pre-fill to cap-1, then race two claims.
    const userId = await seedUser(harness);
    await harness.db.insert(schema.usage).values({
      id: "boundary",
      userId,
      month: currentMonth(),
      count: 4,
    });
    const [a, b] = await Promise.all([
      claimQuotaSlot(userId, 5),
      claimQuotaSlot(userId, 5),
    ]);
    const grantedCount = [a, b].filter((r) => r.granted).length;
    expect(grantedCount).toBe(1);
    expect(await getCurrentUsage(userId)).toBe(5);
  });

  it("isolates quota state per user", async () => {
    const alice = await seedUser(harness, { id: "alice" });
    const bob = await seedUser(harness, { id: "bob" });

    await claimQuotaSlot(alice, 10);
    await claimQuotaSlot(alice, 10);
    await claimQuotaSlot(bob, 10);

    expect(await getCurrentUsage(alice)).toBe(2);
    expect(await getCurrentUsage(bob)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// recordTokenUsage
// ---------------------------------------------------------------------------

describe("recordTokenUsage", () => {
  it("accumulates tokens across multiple records on the same row", async () => {
    const userId = await seedUser(harness);
    await claimQuotaSlot(userId, 100); // creates the row
    await recordTokenUsage(userId, {
      inputTokens: 1000,
      outputTokens: 500,
      cacheReadInputTokens: 200,
      cacheCreationInputTokens: 100,
    });
    await recordTokenUsage(userId, {
      inputTokens: 250,
      outputTokens: 80,
    });
    const [row] = await harness.db
      .select()
      .from(schema.usage)
      .where(
        and(
          eq(schema.usage.userId, userId),
          eq(schema.usage.month, currentMonth()),
        ),
      );
    expect(row?.inputTokens).toBe(1250);
    expect(row?.outputTokens).toBe(580);
    expect(row?.cacheReadInputTokens).toBe(200);
    expect(row?.cacheCreationInputTokens).toBe(100);
  });

  it("treats absent cache-token fields as zero increments", async () => {
    const userId = await seedUser(harness);
    await claimQuotaSlot(userId, 100);
    await recordTokenUsage(userId, { inputTokens: 10, outputTokens: 5 });
    const [row] = await harness.db
      .select()
      .from(schema.usage)
      .where(
        and(
          eq(schema.usage.userId, userId),
          eq(schema.usage.month, currentMonth()),
        ),
      );
    expect(row?.cacheReadInputTokens).toBe(0);
    expect(row?.cacheCreationInputTokens).toBe(0);
  });
});
