/**
 * GET /api/team-analytics/overrides?range=7|30|90
 *
 * Per-team override aggregation. Backs the `/dashboard/overrides` page
 * (BUILD_PLAN_v2 Session 11). Mirrors `/api/team-analytics` patterns:
 *
 *   - Auth via Clerk session OR Bearer cx_<api_key>
 *   - Admin-only (team_owner_user_id == null) per BUILD_PLAN §17 +
 *     BE-M-05 audit fix
 *   - Range = 7 / 30 / 90 days
 *   - Free/Pro callers get an empty payload, not 403, so the dashboard
 *     can render a clean upsell
 *
 * Output shape:
 *   {
 *     plan, is_team, range, range_start, generated_at,
 *     totals: { overrides, override_rate },
 *     top_standards: [{ standard_id, moment, count }],
 *     by_type: [{ override_type, count }],
 *     daily: [{ date, count }],
 *   }
 */

import { and, desc, eq, gte, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { envelope } from "@/lib/api-envelope";
import { resolveAuth } from "@/lib/auth";
import { getDb, schema } from "@/db";

type Range = 7 | 30 | 90;
const SUPPORTED_RANGES: Range[] = [7, 30, 90];

export async function GET(req: Request) {
  const auth = await resolveAuth(req);
  if ("status" in auth) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  if (auth.plan !== "team") {
    return NextResponse.json(
      envelope({
        plan: auth.plan,
        is_team: false,
        message: "Override analytics requires a Team plan.",
      }),
    );
  }

  if (auth.teamOwnerUserId !== null) {
    return NextResponse.json(
      { error: "Override analytics is available to team owners only." },
      { status: 403 },
    );
  }

  const url = new URL(req.url);
  const rawRange = Number(url.searchParams.get("range") ?? "30");
  const range: Range = SUPPORTED_RANGES.includes(rawRange as Range)
    ? (rawRange as Range)
    : 30;

  const teamId = auth.teamOwnerUserId ?? auth.user.id;
  const since = new Date(Date.now() - range * 24 * 60 * 60 * 1000);
  const db = getDb();

  // Total overrides + total violations in the same window so the rate
  // story makes sense ("you overrode 14% of your team's findings this
  // month").
  const [{ overrides_count = 0 } = { overrides_count: 0 }] = (await db
    .select({ overrides_count: sql<number>`count(*)::int` })
    .from(schema.violationOverrides)
    .where(
      and(
        eq(schema.violationOverrides.teamId, teamId),
        gte(schema.violationOverrides.createdAt, since),
      ),
    )) as Array<{ overrides_count: number }>;

  const [{ violations_count = 0 } = { violations_count: 0 }] = (await db
    .select({ violations_count: sql<number>`count(*)::int` })
    .from(schema.violations)
    .where(
      and(
        eq(schema.violations.teamId, teamId),
        gte(schema.violations.createdAt, since),
      ),
    )) as Array<{ violations_count: number }>;

  // Top (standard_id, moment) pairs by override count.
  const topStandards = (await db
    .select({
      standard_id: schema.violationOverrides.standardId,
      moment: schema.violationOverrides.moment,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.violationOverrides)
    .where(
      and(
        eq(schema.violationOverrides.teamId, teamId),
        gte(schema.violationOverrides.createdAt, since),
      ),
    )
    .groupBy(
      schema.violationOverrides.standardId,
      schema.violationOverrides.moment,
    )
    .orderBy(desc(sql`count(*)`))
    .limit(10)) as Array<{
    standard_id: string;
    moment: string | null;
    count: number;
  }>;

  // Distribution across override_type — informs whether your team treats
  // overrides as "dismiss" (rule doesn't apply) vs "false positive"
  // (rule fired wrongly), which feeds the global rule-review queue.
  const byType = (await db
    .select({
      override_type: schema.violationOverrides.overrideType,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.violationOverrides)
    .where(
      and(
        eq(schema.violationOverrides.teamId, teamId),
        gte(schema.violationOverrides.createdAt, since),
      ),
    )
    .groupBy(schema.violationOverrides.overrideType)
    .orderBy(desc(sql`count(*)`))) as Array<{
    override_type: string;
    count: number;
  }>;

  // Daily counts. Same shape as /api/team-analytics's daily series so
  // the dashboard can chart them with the same widget if it wants.
  const daily = (await db
    .select({
      date: sql<string>`to_char(${schema.violationOverrides.createdAt}, 'YYYY-MM-DD')`,
      count: sql<number>`count(*)::int`,
    })
    .from(schema.violationOverrides)
    .where(
      and(
        eq(schema.violationOverrides.teamId, teamId),
        gte(schema.violationOverrides.createdAt, since),
      ),
    )
    .groupBy(sql`to_char(${schema.violationOverrides.createdAt}, 'YYYY-MM-DD')`)
    .orderBy(sql`to_char(${schema.violationOverrides.createdAt}, 'YYYY-MM-DD')`)) as Array<{
    date: string;
    count: number;
  }>;

  return NextResponse.json(
    envelope({
      plan: auth.plan,
      is_team: true,
      range,
      range_start: since.toISOString(),
      generated_at: new Date().toISOString(),
      totals: {
        overrides: overrides_count,
        violations_in_range: violations_count,
        override_rate:
          violations_count > 0
            ? Math.round((overrides_count / violations_count) * 1000) / 10
            : null,
      },
      top_standards: topStandards,
      by_type: byType,
      daily,
    }),
  );
}
