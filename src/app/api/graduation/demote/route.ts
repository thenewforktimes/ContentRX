/**
 * POST /api/graduation/demote — manually demote a graduated standard.
 *
 * Human-eval build plan Session 12. Reverse of the approve endpoint.
 * Admin-gated; logs the decision to `graduation_status.history` with
 * `source: "manual_approval"` so the audit trail stays complete.
 *
 * Body:
 *   {
 *     standard_id: string,
 *     target_level: "robo_labels" | "batch_approval",
 *     reason: string  // required — manual demotions always need justification
 *   }
 *
 * Returns 409 when the target isn't strictly below the current level.
 * Re-graduation requires re-earning all six criteria; there is no
 * fast-path. See `tools/graduation_metrics.py`.
 */

import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import {
  canApproveGraduation,
  getGraduationStatus,
  isPromotion,
  levelRank,
  recordLevelChange,
  type GraduationLevel,
} from "@/lib/graduation";
import { sanitizeZodIssues } from "@/lib/zod-errors";

const RequestSchema = z.object({
  standard_id: z.string().min(1).max(64),
  target_level: z.enum(["robo_labels", "batch_approval"]),
  reason: z.string().min(1).max(2000),
});

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (!canApproveGraduation(userId)) {
    return NextResponse.json(
      {
        error:
          "Demotion is restricted. Add your Clerk user ID to the CONTENTRX_ADMIN_CLERK_IDS env var.",
      },
      { status: 403 },
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", issues: sanitizeZodIssues(parsed.error.issues) },
      { status: 400 },
    );
  }

  const { standard_id, target_level, reason } = parsed.data;

  const current = await getGraduationStatus(standard_id);
  const currentLevel: GraduationLevel = current?.level ?? "robo_labels";

  // Demotion requires the target be strictly below the current level.
  if (
    isPromotion(currentLevel, target_level)
    || levelRank(target_level) === levelRank(currentLevel)
  ) {
    return NextResponse.json(
      {
        error: `Cannot demote from ${currentLevel} to ${target_level} — that's not a strict step down. Use /api/graduation/approve for promotions.`,
      },
      { status: 409 },
    );
  }

  await recordLevelChange({
    standardId: standard_id,
    newLevel: target_level,
    reason,
    approver: userId,
    source: "manual_approval",
  });

  return NextResponse.json(
    {
      ok: true,
      standard_id,
      previous_level: currentLevel,
      new_level: target_level,
      approver: userId,
    },
    { status: 201 },
  );
}
