/**
 * `/dashboard/team/rules` — legacy redirect.
 *
 * Phase 6 of the pre-pilot launch build. The canonical surface
 * is now `/dashboard/rules` (which renders the editor for Team
 * plans and a read-only catalog for Free / Pro / Scale). This
 * stub keeps any in-the-wild bookmarks and email links working.
 */

import { redirect } from "next/navigation";

export default function TeamRulesRedirect() {
  redirect("/dashboard/rules");
}
