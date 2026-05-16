# ADR: Private taxonomy with public evidence of work

**Date:** 2026-04-25
**Status:** Accepted
**Owner:** Robert
**Supersedes:** None

## Context

ContentRX was originally architected and planned with a "public model first" assumption. BUILD_PLAN sessions 7, 19, and 20 scoped publishing the standards library as a public open-source repository (`contentrx-standards`, CC-BY 4.0), shipping a public docs site at `docs.contentrx.app` with browsable `/standards` and `/moments` pages, and exposing per-standard permalinks on a `/model` page that violation responses would deep-link to via a `docs_url` field on every Violation. The architecture was: engine private, taxonomy public, with the open spec serving as a credibility wedge and an SEO surface.

Acquisition and pricing research completed 2026-04-25 reframed the moat. The closest launch analog for ContentRX is PostHog (writer-friendly, capital-light, named-founder credibility) — not Linear, Raycast, or Cal.com, all of which had structural advantages absent in the current case (10K-person waitlists seeded by founders' Twitter audiences, multi-year free-tier runways, freakishly well-timed open-source SEO arbitrage). The named-expert positioning depends on Robert as a named staff content designer, with the moat compounding through Robert's accumulated annotations and weekly calibration cadence rather than through a public taxonomy artifact. The Tailwind / Linear / Stripe pattern (private taxonomy driving an opinionated public product) is the structurally clean shape for this positioning.

The acquisition research also identified two hard constraints that pull against a public taxonomy. First, the 5–8 hour weekly time budget post-launch can sustain *either* a writing-driven content flywheel *or* a public-spec maintenance burden, but not both, on a single founder with a day job. Second, the named-expert moat is fragile against competitive copying if the taxonomy is public — a competitor with a larger paid ads budget could recreate the spec in a week and out-distribute the original. Restrictive licensing (source-available, non-compete) doesn't prevent paraphrase on a content-design taxonomy.

The decision to make the taxonomy private was not architectural — it followed the positioning and pricing research. This ADR captures the architectural consequences.

## Decision

The 47 standards, 13 moments, per-standard `version` and `version_history` metadata, the `influences` field, and the rationale-chain detail become private internal artifacts. They live in `standards_library.json`, are owned by the engine, and are accessible only through a founder-authenticated `/admin` dashboard.

The public surface becomes:

- `/accuracy` — measured system kappa with 95% CI, measured self-drift kappa with 95% CI, target ceiling of 0.90 stated separately. Generated nightly from substrate.
- `/calibration` — weekly calibration log entries: kappa movement, drift detection, override count, notable refinement-log activity. Generated automatically every Monday.
- `/essays` — monthly named-expert essays in Robert's voice, hand-written, citing auto-generated artifacts from `/accuracy` and `/calibration`.
- `/reports` — quarterly accuracy reports. Generated scaffold, hand-edited narrative.

The wire format ships at `schema_version: 2.0.0` (major bump). Removed from the public Violation envelope: `docs_url`, `related_standards`, `rationale_chain`. Stripped from user-visible surfaces (web app, MCP response, CLI output, Figma plugin, GitHub Action PR comments) but retained in internal substrate API responses: `standard_id`, `rule_version`. Retained and made more central: `issue`, `suggestion` — these become the entire user-facing artifact.

The `contentrx-standards` public repository is canceled. If already pushed to GitHub, it is archived (preserving the URL and history) rather than deleted.

The `docs.contentrx.app` site does not ship the `/standards`, `/standards/[id]`, `/moments`, or `/moments/[id]` routes. Build script `scripts/generate-spec.mjs` is removed from the deploy pipeline. The site instead renders the public reports and essays.

BUILD_PLAN sessions 7 (CLI to PyPI + open content model repo), 19 (docs.contentrx.app launch), and 20 (versioned standards + OSS license) move to a DEFERRED section in BUILD_PLAN.md, preserved with full rationale, not deleted. Reversibility matters; the work product retains value if the positioning pivots back.

A new founder dashboard at `/admin` is added to BUILD_PLAN as a critical-path session. It includes `/admin/model` (browsable taxonomy), `/admin/calibration` (substrate UI), `/admin/refinement-log` (refinement-log UI), `/admin/queue` (review queue with subtype filters), `/admin/reports` (preview before publish), and `/admin/essay-drafts` (essay drafting workspace with auto-citations).

A new module `reports/` is added to the architecture, separating eval **substrate** (private; full taxonomy, complete override stream, refinement log) from eval **report** (public; kappa numbers, drift trends, narrative essays). The substrate produces the report through scheduled generators; nothing outside reads the substrate.

Code paths previously dependent on the public-taxonomy assumption are gated behind a `PUBLIC_TAXONOMY=false` feature flag, default off, rather than deleted. Reversibility is preserved.

## Alternatives considered

**(A) Keep public taxonomy as originally planned.** Rejected because the moat hypothesis changed. The research found no comparable named-expert tool — in the writer-founder, solo-operator, 5-hour-weekly-budget shape — where a public taxonomy was the load-bearing growth mechanism. PostHog, the closest analog, scaled on personal network, cold LinkedIn, and a single Show HN — not on its public schema. Keeping a public taxonomy would force the founder to maintain two flywheels (writing and spec) on a single time budget, which the research found to be infeasible.

**(B) Hybrid — publish moments but not standards.** Rejected because the moments alone are too abstract to be useful as a public artifact (a list of 13 nouns is not citable in a PR comment) and yet specific enough that a competitor could derive the standards underneath them in a few weeks. The hybrid surfaces the largest competitive risk for the smallest credibility return.

**(C) Full closed-source with no public artifacts at all.** Rejected because the named-expert moat depends on public evidence of work. Without `/accuracy` and the calibration log, the only credibility signal is Robert's own writing, which puts excessive load on the essays as the sole channel. The substrate-vs-report architecture splits the load across automatic (numbers, drift) and manual (narrative) artifacts.

**(D) Public taxonomy under restrictive license (e.g., source-available, non-compete).** Rejected because restrictive licensing on a content design taxonomy doesn't prevent paraphrase — a competitor can read the spec and rewrite it in their own words without violating the license. Restrictive licenses on text artifacts buy little protection at meaningful adoption cost.

## Consequences

**Positive.** The moat aligns with founder positioning rather than competing with it; every essay Robert writes compounds the moat rather than competing with the public spec for attention. Reversibility is preserved through the feature flag and the DEFERRED section of BUILD_PLAN. UX simplifies meaningfully — users see plain-language guidance instead of standard IDs they don't understand. The competitive-copy risk on the taxonomy goes to near-zero. The wire format becomes cleaner and smaller. The architectural shape (private substrate, public report) maps onto a well-validated industry pattern (Tailwind, Linear, Stripe's internal style guide). Maintenance burden on the public surface goes down: there are far fewer pages to keep current than under the public-taxonomy plan.

**Negative.** SEO opportunity from public standard pages is lost. The named-expert moat means continuity matters — if Robert stops publishing essays for a quarter, the moat erodes; this is a real fragility the architecture must accommodate (monitoring on stale generators, alerting). Some prospect segments (engineers who distrust personality-driven products) will bounce; this is a known trade. The report-generation pipeline becomes critical infrastructure — if it stales or breaks, the only public credibility signal disappears. This requires P0-grade operational discipline on what was previously considered marketing infrastructure. Internal customers (Robert, in the daily review rhythm) depend on `/admin` being functional; previously that surface was optional. The wire format breaks at `schema_version: 2.0.0`, requiring a one-touch migration for the small set of paid early customers integrated against `1.x`.

**Neutral but worth naming.** The Python evaluation engine, the eval corpus, the 1,010-test suite, the override stream, the refinement log, EVAL_PROTOCOL.md, the audit cadences, and the confidence calibration are all unchanged. The substrate is the same; only the report destination moves. This is the least-invasive shape the pivot could take, which is an architectural feature, not a coincidence — the original architecture had a clean substrate/surface separation that this pivot reuses.

## Triggers for revisiting

- By week 12 of launch, paying customer count is below 25 *and* customer development calls surface "lack of public taxonomy as credibility signal" as a recurring objection (≥3 mentions across the 25 calls).
- A competitor publishes a similar private-taxonomy tool with measurable traction and the named-expert moat alone is no longer sufficient differentiation.
- Acquisition interest from Ditto, Figma, GitHub, or another strategic acquirer materializes and a public taxonomy is part of the deal value.
- Robert's bandwidth changes (e.g., leaves PayPal, hires a collaborator) such that maintaining both a writing flywheel and a public spec becomes feasible.

Reversal, if it happens, is governed by a new ADR superseding this one. It is not an in-session decision.

## References

- Research output, 2026-04-25: ContentRX launch quarter playbook (90-day acquisition, pricing, meta-template)
- BUILD_PLAN.md sessions 7, 19, 20 (DEFERRED)
- BUILD_PLAN_v2.md sessions 19, 20 (DEFERRED)
- HUMAN_EVAL_BUILD_PLAN.md (substrate definition unchanged)
- Architectural pattern: Tailwind, Linear, Stripe internal style guide
- Launch analog: PostHog "How we got our first 1,000 users"
- Mitchell et al. 2019, Model Cards for Model Reporting (kappa-with-CI reporting convention on `/accuracy`)

---

## Addendum — 2026-05-16: the cross-surface presentation line

**Status:** Accepted (pending Robert's sign-off on this PR). **Owner:** Robert.
**Extends, does not supersede, the decision above.**

A privacy-boundary audit (2026-05-15; register
`_private/audit-privacy-boundary-2026-05-15.md`) confirmed the original
decision is well-defended on the `standard_id` / `rule_version` axis,
but found the line was never stated precisely for *prose and
exemplars*, and three surfaces sit on the wrong side of it.

**The line, stated precisely:** category names are public. **Standard
IDs, standards prose, and correct/incorrect exemplars are private
substrate and never reach any user-facing surface.** This extends the
original "one pipeline, no verdict drift" non-negotiable from the
*verdict* layer to the *presentation* layer: **every check surface —
web, CLI, MCP, LSP, GitHub Action, Figma plugin, the weekly agent
digest — emits the same human-relatable flags (issue / suggestion /
severity / category) and nothing beneath them.** The agent in
particular reports drifts/flags exactly like every other surface; it
does not "explain" via the taxonomy.

**This also retires the "one allowed exception" carve-out.** The
original note that `/dashboard/rules` may render standard IDs is
withdrawn (CLAUDE.md updated in lock-step). IDs are display-labelled
there already; the residual prose/exemplar exposure on that surface is
finding F3 below.

**Disposition of the audit findings under this line:**

- **F4** — CLI `--json` defence-in-depth. Fixed + merged (PR #585).
- **F2** — the weekly agent digest (`render-digest.ts`
  `patternExamplePair`) embedded standards exemplar prose. Fixed in
  this PR: the cold-start citation now stands on the team's own flag
  count only; a substrate fence test pins it. Gated ahead of
  CRITICAL-PATH #1 (the GitHub App must not go live posting exemplars).
- **F1** — the Figma plugin ships ~28 substrate standard IDs + their
  heuristics in plaintext `ui.html` (client-side preprocessor;
  predates this ADR). Tracked: opaque-ize the preprocessor's tags
  before any plugin-marketplace push or when the custom-rules UX
  cluster is built. Not auto-fixed (touches the shipped plugin).
- **F3** — `/dashboard/rules` renders standards prose + exemplars to
  customers. Tracked with the parked custom-rules UX cluster.
- **F5** — add render substrate-absence tests for the
  `/dashboard/rules` components once F3 is implemented (pin the
  intended shape, not today's accidental one).

**Why an addendum, not a new ADR:** the moat decision is unchanged.
This only writes down a boundary the original left implicit and
records its consequences. Reversal of the parent decision still
requires a superseding ADR; this addendum travels with it.
