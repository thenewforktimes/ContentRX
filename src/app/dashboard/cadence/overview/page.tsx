/**
 * /dashboard/cadence/overview — Review-cadence hub.
 *
 * Human-eval build plan Session 33. One view that shows all four
 * cadences (weekly / monthly / quarterly / annual) with their
 * target interval, last-completion timestamp, and status
 * (on_track / eligible / overdue). Links out to the per-cadence
 * surfaces.
 *
 * Team-plan admin only, same gate as the rest of /dashboard/cadence/*.
 *
 * Purpose: the "orchestration" artifact the plan calls for. Replaces
 * any sense that these cadences are informal — each one has a fixed
 * interval, a grace window, a measurable status, and a linked next
 * action.
 */

import { auth } from "@clerk/nextjs/server";
import { desc, eq } from "drizzle-orm";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getDb, schema } from "@/db";
import {
  cadenceArtifactRefs,
  latestAnnualReportCompletedAt,
  latestDriftReportCompletedAt,
} from "@/lib/review-cadence-disk";
import {
  evaluateAllCadences,
  statusMessage,
  type CadenceKind,
  type CadenceSnapshot,
} from "@/lib/review-cadence-timing";

const CADENCE_SURFACES: Record<CadenceKind, { href: string; label: string }> = {
  weekly: { href: "/dashboard/cadence", label: "Daily/weekly queue" },
  monthly: {
    href: "/dashboard/cadence/calibration",
    label: "Moment rotation",
  },
  quarterly: {
    href: "/dashboard/cadence/quarterly",
    label: "Quarterly review",
  },
  annual: { href: "/dashboard/cadence/annual", label: "Annual audit" },
};

export default async function CadenceOverviewPage() {
  const { userId: clerkId } = await auth();
  if (!clerkId) redirect("/sign-in?redirect_url=/dashboard/cadence/overview");

  const db = getDb();
  const [user] = await db
    .select()
    .from(schema.users)
    .where(eq(schema.users.clerkId, clerkId))
    .limit(1);

  if (!user || user.plan !== "team" || user.teamOwnerUserId !== null) {
    redirect("/dashboard/cadence");
  }

  const teamId = user.teamOwnerUserId ?? user.id;
  const now = new Date();

  // Weekly is derived from override activity: the most recent team
  // override is the best signal the team has looked at the queue.
  // It's a rough proxy — genuinely "no overrides ⇒ never ran" would
  // be wrong for a team with a clean week, but the surface-message
  // copy handles that case.
  const [latestOverride] = await db
    .select({ createdAt: schema.violationOverrides.createdAt })
    .from(schema.violationOverrides)
    .where(eq(schema.violationOverrides.teamId, teamId))
    .orderBy(desc(schema.violationOverrides.createdAt))
    .limit(1);

  const lastCompleted: Partial<Record<CadenceKind, Date | null>> = {
    weekly: latestOverride?.createdAt ?? null,
    monthly: latestDriftReportCompletedAt(),
    quarterly: latestDriftReportCompletedAt(),
    annual: latestAnnualReportCompletedAt(),
  };

  const snapshots = evaluateAllCadences(lastCompleted, now);
  const overdueCount = snapshots.filter((s) => s.status === "overdue").length;
  const artifacts = cadenceArtifactRefs();

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-xs font-mono uppercase tracking-widest text-neutral-500">
          Review cadence · overview
        </p>
        <h1 className="mt-2 text-2xl font-semibold">Taxonomy review rhythm</h1>
        <p className="mt-1 text-sm text-neutral-600 dark:text-neutral-400">
          Four cadences keep the content model honest. The quarterly one
          recalibrates graduation thresholds and is load-bearing; the
          others catch patterns the automation misses.
        </p>
      </header>

      <section className="grid grid-cols-3 gap-4 text-sm">
        <StatCard
          label="Cadences on track"
          value={snapshots.filter((s) => s.status === "on_track").length.toString()}
        />
        <StatCard
          label="Due now"
          value={snapshots.filter((s) => s.status === "eligible").length.toString()}
          tone={
            snapshots.some((s) => s.status === "eligible") ? "warn" : "default"
          }
        />
        <StatCard
          label="Overdue"
          value={overdueCount.toString()}
          tone={overdueCount > 0 ? "warn" : "default"}
        />
      </section>

      <section className="flex flex-col gap-4">
        {snapshots.map((s) => (
          <CadenceCard key={s.kind} snapshot={s} />
        ))}
      </section>

      <section className="rounded-md border border-neutral-200 p-4 text-sm dark:border-neutral-800">
        <h2 className="text-sm font-semibold">Artifacts on disk</h2>
        <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-400">
          The hub derives last-completion dates from these paths. If a
          path doesn&apos;t exist yet, run the relevant cadence tool.
        </p>
        <ul className="mt-3 flex flex-col gap-1 font-mono text-xs">
          {artifacts.map((a) => (
            <li key={a.relativePath}>
              <span className="text-neutral-500">{a.relativePath}</span>{" "}
              {a.lastCompletedAt ? (
                <span>
                  — newest {a.lastCompletedAt.toISOString().slice(0, 10)}
                </span>
              ) : (
                <span className="text-neutral-400">— empty</span>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section className="rounded-md border border-neutral-200 p-4 text-sm dark:border-neutral-800">
        <h2 className="text-sm font-semibold">Templates</h2>
        <p className="mt-2 text-xs text-neutral-600 dark:text-neutral-400">
          Fill a template per cycle, save the output to{" "}
          <code className="font-mono">evals/cadence_runs/&lt;kind&gt;/</code>.
          The hub picks up the newest file there.
        </p>
        <ul className="mt-3 flex flex-col gap-1 font-mono text-xs">
          <li>evals/cadence_templates/weekly.md</li>
          <li>evals/cadence_templates/monthly.md</li>
          <li>evals/cadence_templates/quarterly.md</li>
          <li>evals/cadence_templates/annual.md</li>
        </ul>
      </section>

      <Link
        href="/dashboard/cadence"
        className="text-xs text-neutral-600 underline underline-offset-2 dark:text-neutral-400"
      >
        ← Back to daily queue
      </Link>
    </div>
  );
}

function CadenceCard({ snapshot }: { snapshot: CadenceSnapshot }) {
  const surface = CADENCE_SURFACES[snapshot.kind];
  const toneClass =
    snapshot.status === "overdue"
      ? "border-amber-400 bg-amber-50/60 dark:border-amber-800 dark:bg-amber-950/30"
      : snapshot.status === "eligible"
      ? "border-neutral-400 dark:border-neutral-600"
      : "border-neutral-200 dark:border-neutral-800";

  return (
    <article className={`flex flex-col gap-3 rounded-lg border p-5 ${toneClass}`}>
      <header className="flex items-center justify-between">
        <div>
          <p className="text-xs font-mono uppercase tracking-widest text-neutral-500">
            {snapshot.kind} · every {snapshot.spec.intervalDays}d
            {snapshot.spec.loadBearing && " · load-bearing"}
          </p>
          <h2 className="mt-1 text-lg font-semibold capitalize">
            {snapshot.kind} review
          </h2>
        </div>
        <StatusBadge status={snapshot.status} />
      </header>
      <p className="text-sm text-neutral-600 dark:text-neutral-400">
        {snapshot.spec.purpose}
      </p>
      <p className="text-xs text-neutral-500">{statusMessage(snapshot)}</p>
      <Link
        href={surface.href}
        className="w-max rounded-md border border-neutral-300 px-3 py-1.5 text-xs font-medium hover:bg-neutral-50 dark:border-neutral-700 dark:hover:bg-neutral-900"
      >
        Open {surface.label}
      </Link>
    </article>
  );
}

function StatusBadge({ status }: { status: CadenceSnapshot["status"] }) {
  const label = {
    on_track: "On track",
    eligible: "Due now",
    overdue: "Overdue",
  }[status];
  const cls = {
    on_track:
      "bg-neutral-100 text-neutral-700 dark:bg-neutral-900 dark:text-neutral-300",
    eligible:
      "bg-neutral-200 text-neutral-900 dark:bg-neutral-800 dark:text-neutral-100",
    overdue: "bg-amber-200 text-amber-900 dark:bg-amber-800 dark:text-amber-100",
  }[status];
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

function StatCard({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "warn";
}) {
  const valueColor =
    tone === "warn"
      ? "text-amber-700 dark:text-amber-300"
      : "text-neutral-900 dark:text-neutral-100";
  return (
    <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <p className="text-xs uppercase tracking-wider text-neutral-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${valueColor}`}>{value}</p>
    </div>
  );
}
