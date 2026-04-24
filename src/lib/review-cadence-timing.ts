/**
 * Review cadence timing — human-eval build plan Session 33.
 *
 * Pure helpers for orchestrating the four taxonomy-review cadences:
 *
 *   Weekly     — override-stream scan (Session 9 daily aggregates)
 *   Monthly    — rotating moment deep-review (Session 9 weekly)
 *   Quarterly  — drift check + threshold recalibration (Session 7 / 10)
 *   Annual     — full corpus audit (Session 36)
 *
 * Every cadence has a target interval and a fixed grace window beyond
 * which a late cycle triggers an `overdue` signal. The weekly cadence
 * is surface-level enough that "never ran" defaults to eligible; the
 * quarterly cadence is load-bearing (graduation thresholds ride on
 * it) so a missed cycle is surfaced loudly.
 *
 * No DB / filesystem access — the server components pass the
 * last-completed timestamps in. Test-driven here; the surface pages
 * read drift reports / audit reports to derive those timestamps.
 */

export type CadenceKind = "weekly" | "monthly" | "quarterly" | "annual";

export interface CadenceSpec {
  kind: CadenceKind;
  intervalDays: number;
  graceDays: number;
  loadBearing: boolean;
  purpose: string;
}

export const CADENCE_SPECS: readonly CadenceSpec[] = [
  {
    kind: "weekly",
    intervalDays: 7,
    graceDays: 3,
    loadBearing: false,
    purpose: "Override-stream scan: what the team dismissed this week.",
  },
  {
    kind: "monthly",
    intervalDays: 28,
    graceDays: 14,
    loadBearing: false,
    purpose:
      "Rotate one of 13 moments for deep review — 13-week cycle keeps every moment covered.",
  },
  {
    kind: "quarterly",
    intervalDays: 91,
    graceDays: 21,
    loadBearing: true,
    purpose:
      "Drift check + threshold recalibration. Graduation thresholds depend on the measured ceiling.",
  },
  {
    kind: "annual",
    intervalDays: 365,
    graceDays: 60,
    loadBearing: false,
    purpose:
      "Full corpus audit against the current schema. Surfaces long-term drift the quarterly check misses.",
  },
];

export type CadenceStatus = "eligible" | "on_track" | "overdue";

export interface CadenceSnapshot {
  kind: CadenceKind;
  spec: CadenceSpec;
  lastCompletedAt: Date | null;
  nextDueAt: Date | null;
  daysOverdue: number;
  status: CadenceStatus;
}

export function cadenceSpec(kind: CadenceKind): CadenceSpec {
  const spec = CADENCE_SPECS.find((s) => s.kind === kind);
  if (!spec) {
    throw new Error(`Unknown cadence kind: ${kind}`);
  }
  return spec;
}

/**
 * Decide whether this cadence needs attention given when it last
 * completed. `now` is injectable so server components and tests
 * share one clock.
 */
export function evaluateCadence(
  kind: CadenceKind,
  lastCompletedAt: Date | null,
  now: Date,
): CadenceSnapshot {
  const spec = cadenceSpec(kind);
  if (!lastCompletedAt) {
    return {
      kind,
      spec,
      lastCompletedAt: null,
      nextDueAt: null,
      daysOverdue: 0,
      status: "eligible",
    };
  }

  const intervalMs = spec.intervalDays * 24 * 60 * 60 * 1000;
  const graceMs = spec.graceDays * 24 * 60 * 60 * 1000;
  const nextDueAt = new Date(lastCompletedAt.getTime() + intervalMs);
  const overdueAt = new Date(nextDueAt.getTime() + graceMs);
  const daysOverdue = Math.max(
    0,
    Math.floor((now.getTime() - nextDueAt.getTime()) / (24 * 60 * 60 * 1000)),
  );

  let status: CadenceStatus;
  if (now < nextDueAt) status = "on_track";
  else if (now < overdueAt) status = "eligible";
  else status = "overdue";

  return {
    kind,
    spec,
    lastCompletedAt,
    nextDueAt,
    daysOverdue,
    status,
  };
}

/**
 * Convenience: build snapshots for all four cadences at once.
 * Pass `null` for any cadence that hasn't completed a cycle yet.
 */
export function evaluateAllCadences(
  lastCompleted: Partial<Record<CadenceKind, Date | null>>,
  now: Date,
): CadenceSnapshot[] {
  return CADENCE_SPECS.map((spec) =>
    evaluateCadence(spec.kind, lastCompleted[spec.kind] ?? null, now),
  );
}

/**
 * Human-readable status line for the cadence hub. Keeps the
 * copy in one place so the UI and the CLI stay in sync.
 */
export function statusMessage(snapshot: CadenceSnapshot): string {
  if (!snapshot.lastCompletedAt) {
    return snapshot.spec.loadBearing
      ? "Never run — load-bearing cadence, start soon."
      : "Never run — first cycle is the baseline.";
  }
  if (snapshot.status === "on_track") {
    const d = snapshot.nextDueAt!;
    return `On track. Next cycle due ${d.toISOString().slice(0, 10)}.`;
  }
  if (snapshot.status === "eligible") {
    return `Due now. Ran ${formatSince(snapshot.lastCompletedAt!, snapshot.spec.intervalDays)} ago.`;
  }
  return `Overdue by ${snapshot.daysOverdue} day${snapshot.daysOverdue === 1 ? "" : "s"}. ${
    snapshot.spec.loadBearing ? "Load-bearing — run it." : "Catch up when possible."
  }`;
}

function formatSince(date: Date, targetDays: number): string {
  const now = Date.now();
  const deltaDays = Math.floor((now - date.getTime()) / (24 * 60 * 60 * 1000));
  if (deltaDays >= targetDays * 2) {
    return `${deltaDays} days`;
  }
  if (deltaDays >= 21) {
    return `${Math.round(deltaDays / 7)} weeks`;
  }
  return `${deltaDays} days`;
}
