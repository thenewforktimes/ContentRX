/**
 * Resolve the canonical "team-id-as-user-id" scope key for a given
 * authenticated user.
 *
 * Today (2026-04-27) we hit a write-vs-read mismatch where /api/check
 * was writing `team_id = NULL` for free/Pro users while every
 * dashboard reader queries `team_id = teamOwnerUserId ?? userId`.
 * Result: 21 violations in the DB, dashboard rendered 0. The
 * fix (PR-198) was to write the same shape readers expect.
 *
 * This helper centralizes that contract so every future write path
 * uses the same expression — single source of truth.
 *
 * Rules:
 *   - team owner       → own user.id (auth.teamOwnerUserId is null;
 *                        promote to user.id so per-team rollups work)
 *   - team member      → owner's user.id (auth.teamOwnerUserId is set)
 *   - free / Pro user  → own user.id ("your team is just you")
 *
 * Use this for any write to:
 *   - violations
 *   - violation_overrides
 *   - any future per-user / per-team aggregation table the dashboard
 *     reads via `team_id = teamOwnerUserId ?? userId`
 *
 * Pure function, no I/O. No tests beyond the unit tests in
 * team-scope.test.ts; the contract is the function signature.
 */

export type TeamScopeAuth = {
  user: { id: string };
  teamOwnerUserId: string | null;
};

/**
 * Returns the team_id the readers expect for this caller.
 * Never returns null — every authenticated request has a scope key.
 */
export function teamScope(auth: TeamScopeAuth): string {
  return auth.teamOwnerUserId ?? auth.user.id;
}
