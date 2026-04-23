# Human evaluation build plan

Companion document to `BUILD_PLAN_v2.md`. This plan covers the human evaluation layer specifically — the schema, the signal capture, the review infrastructure, the graduation ladder, the external signal acquisition, the product surfaces that make the content model visible, and the stewardship rhythm. Everything here is designed to make Robo's judgment the irreducible core of ContentRX and to progressively let parts of the system run with his approval rather than his labor.

**Version:** 3 — revised 2026-04-23 after a second-pass research memo ("ContentRX Graduation Thresholds, Counterpart Minimums, and Queue Ordering: Calibration to the 0.90 Self-Drift Ceiling") calibrated three sets of numbers against published literature and against a 0.90 self-drift north-star ceiling. Version 2 was revised earlier the same day after a careful read of the current codebase to correct greenfield-framing errors. This v3 adds the calibrated numbers from the memo, which change Sessions 7, 8, 10, 33, and 36 and the kappa-threshold standing note. No structural decisions change; only the specific thresholds, tier minimums, queue-ordering logic, and measurement cadence.

**Version 2 context (retained):** revised after a careful read of `ARCHITECTURE.md`, `standards_library.json`, the engine source, `EVAL_PROTOCOL.md`, `taxonomy_refinement_log.md`, `ditto_cases.json`, `ditto_roadmap_eval.json`, `novel_cases.json`, `CLAUDE.md`, `CHANGELOG.md`. v1 treated too much work as greenfield when the infrastructure already existed. v2 corrected that: most sessions are extensions or automation around systems that work, not replacements.

## What changed in v3

**Graduation thresholds are now ratios against the measured self-drift ceiling, not absolute kappa cutoffs.** Session 10 specifies autonomous at 0.94 × measured ceiling (= 0.85 at the 0.90 target) paired with an 80% raw-agreement floor per McHugh (2012); batch-approval at 0.83 × measured ceiling (= 0.75 at target) with 70% raw-agreement floor. When the measured ceiling drifts, thresholds move with it automatically. A measured ceiling below 0.85 triggers taxonomy stabilization rather than looser graduation; below 0.80 freezes graduation entirely.

**MCC supplements kappa for low-prevalence standards.** For any individual standard whose observed positive-class prevalence on the industry corpus is below 15%, Session 10 adds MCC ≥ 0.70 (autonomous) / ≥ 0.60 (batch-approval) as a supplementary gate. This is the one place the plan adds a new metric alongside kappa rather than just recalibrating kappa thresholds — the prevalence paradox literature (Chicco, Warrens & Jurman 2021; Delgado & Tibau 2019) rules out kappa as a reliable signal when one class dominates. Kappa remains the default everywhere else.

**Counterpart gate gains tiered minimums and hard-gate formulation.** Session 10 replaces the flat "≥3 counterparts" with a tier by base rate: 5 counterparts for prevalence <15%, 8 for 15–40%, 12 for >40%, plus 3 more for structurally complex rules. Counterparts must span at least two of three structural axes (within-moment, cross-content-type, cross-moment) with the within-moment axis mandatory, target distribution 60/25/15. The gate is hard: autonomous requires all of (counterpart floor met, counterpart pass rate ≥ 80%, kappa threshold met) — AND, not averaged. Rule-version changes trigger a tiered reset (full on semantic changes, 50% weight on wording-only changes, partial on additive carve-outs).

**Queue ordering becomes stage-dependent with a 500-tuple phase trigger.** Session 8 distinguishes an early phase (precedent index has fewer than 500 high-confidence tuples, exploration-weighted) from a late phase (exploitation-weighted). The calibration sample is fixed at 5% of queue in the early phase, 10% in the late phase. Audience remains the outer dimension but now with an explicit re-test trigger: at 50 annotated general-audience cases, recompute the false-positive concentration; retain audience-first only if concentration exceeds 40% of false positives, otherwise drop it.

**Self-drift measurement cadence moves from annual to quarterly.** Session 7 now specifies a quarterly 80-case stratified panel (across moments and content types) per Cicchetti & Fleiss's 2k² rule. The quarterly cadence is a 4× increase in measurement burden versus annual; the justification is that graduation thresholds depend on the measured ceiling, and an annual cadence means up to 364 days of threshold drift before correction. Session 36's annual audit now operates alongside, not instead of, the quarterly drift check.

**Measured ceiling and target ceiling are distinct in public reporting.** The `/accuracy` page (Session 24) reports measured system κ with 95% CI, measured self-drift κ with 95% CI, and the 0.90 design target stated separately — never a composite "accuracy score." This follows Model Cards (Mitchell et al. 2019) guidance on honest metric reporting with intervals.

## What changed in v2 (retained for context)

**Non-negotiable framing rules established before any session scope was rewritten.** The eval corpus at `evals/industry/`, the four-phase eval protocol with structured input amendment, the triage category taxonomy (`correct`/`misclassification`/`hallucination`/`missing_standard`/`context_gap`), the 13-moment taxonomy with its weights and modifiers, the standards library with its routing metadata and content_type_notes, the audience gate with its `_AUDIENCE_CONTENT_TYPE_OVERRIDES` pattern, the `taxonomy_refinement_log.md` with its decision criterion and structured entry shape, and the auto-annotator with its precedent-index confidence calibration — none of these get replaced. Everything in this plan is either (a) an extension that populates or enriches an existing structure, (b) automation around a manual process that already works, or (c) genuinely net-new infrastructure that doesn't exist in any form today.

**The standards library is never replaced wholesale.** `ARCHITECTURE.md` is explicit about this and the rule is upheld: any schema additions in this plan are surgical JSON patches to `standards_library.json`, never rewrites.

**The button_cta split is not on this plan.** 36 context_gap cases from one source (ditto roadmap) is not sufficient evidence to split a content type. The existing refinement log's three pending entries each sit waiting for a second independent source before a decision gets made; button_cta will follow the same discipline. If the pattern reappears on a second source, a REF-004 entry becomes appropriate. For now it stays out of the plan.

**Sessions 16 and 17 collapse into one.** The design system corpus work was originally specified as if it were greenfield normalization. The `sources` field already exists on standards (populated for 17 of 47), `moments.py` already credits five design systems as inspirations for moment weights, and `ditto_cases.json` demonstrates the attribution pattern already functions in the auto-annotator's output. The consolidated session extends what exists rather than building a parallel corpus.

**Situation features as a cross-cutting dimension is deferred to Phase 9.** Some of the existing 13 moments already function as situation-like (destructive_action, compliance_disclosure, trust_permission), and the three modifiers (emphasize/relax/suppress) give most of the calibration power a cross-cutting dimension would. Adding a parallel axis today would create a combinatorial explosion without a clear downstream-behavior change — which is exactly what the refinement log's decision criterion warns against. Revisit when refinement-log evidence shows verdict-changing need.

**Per-standard versioning is added to Session 1 as a hard precondition.** `standards_library.json` carries only a top-level `version: "4.6.1"`; individual standards don't carry per-standard version histories. The novel corpus already implicitly assumes pinning exists (cases reference "the revised CLR-05," "the revised VT-01," "the revised ACT-01"), but the pinning it references isn't actually available. Without per-standard versioning, `rule_version` on eval records is a lie and `rationale_chain` in Session 1 can't be trusted. This is the one schema change that touches the shape of the standards library, implemented as a surgical additive patch that never replaces the file.

**User override reasons and Robo's triage_category remain distinct vocabularies.** Session 4 captures user-facing reasons (*not applicable*, *too strict*, *fix is worse*, *shipping anyway*, *confusing*); Robo's existing triage_category vocabulary (`correct`, `misclassification`, `hallucination`, `missing_standard`, `context_gap`) remains the architectural-response vocabulary used in eval review. These feed different loops: user reasons inform UX and signal; triage_category drives engineering decisions. Robo reconciles the two during batch review. This matches the pattern already visible in `ditto_cases.json`, which carries `suggested_category`, `suggested_confidence`, and `suggested_notes` from the auto-annotator alongside `human_verdict`, `human_confidence`, and `human_notes` from Robo — same shape, different source, reconciled in the approved/revised record.

**The graduation criteria denominator is now precise.** Kappa against Robo's verdicts counts only cases with `review_status ∈ {approved, revised}` and `human_confidence ∈ {high, medium}`. Pending, low-confidence, excluded, and flagged cases are out. This is a one-line clarification that changes how every graduation metric is computed.

**scan/validate disagreement IS the first-pass ensemble.** The existing pipeline runs scan to produce candidates and validate to confirm or reject each one. When validate rejects a scan candidate, that IS ensemble disagreement, already tracked in `PipelineMeta` as `validated_rejected`. Session 13 surfaces this as an `ensemble_disagreement` subtype rather than building a three-way ensemble from scratch.

**Batching by audience is primary.** The ditto roadmap eval showed that all five preprocessor violations in a general-audience sample were false positives overridden by Robo. Batching by moment would have missed the pattern; batching by audience surfaces it immediately. Session 8's batching order is: audience first, then low-confidence-novel-combinations, then standards-conflict, then ensemble-disagreement, then session-aggregate, then calibration sample.

## How this plan is organized

Phases are dependency-ordered, not time-ordered. Each session inside a phase is a discrete unit of build work. Session numbers are stable references; phases are logical groupings. Dependencies between sessions are noted so anything can be picked up without re-deriving context.

Every session has the same shape: a state marker, a one-sentence goal, a scope paragraph, the artifacts it produces, the success criteria that mark it done, and its hard dependencies on earlier sessions.

### State markers

- **SHIPPED** — already exists in production; session is effectively done, kept here for reference
- **EXTEND** — existing infrastructure covers the core; scope is narrow additions to what exists
- **AUTOMATION** — the human process exists and works; scope is automating candidate detection or metric computation around it
- **REFRAME** — original description was wrong about the starting state; scope is different from what v1 said but smaller
- **NET-NEW** — no existing infrastructure; greenfield work
- **DEFER** — called out in v1; explicitly deferred in v2 for a stated reason
- **COLLAPSE** — merged into another session; kept as a pointer

---

## Phase 1 — Evaluation foundation

The schema work that everything downstream depends on. The event shape today is already rich (see `models.py` and the ditto corpus schema); these sessions add the missing pieces that unlock the graduation ladder, the review queue, and per-standard versioning.

### Session 1: Extended evaluation event schema

**State:** EXTEND (core schema exists; narrow additions)

**Goal.** Add the missing fields on eval events and introduce per-standard versioning on `standards_library.json`, so that every downstream signal-capture and graduation decision has the metadata it needs.

**Scope.** The existing envelope carries much of what's needed: every `Violation` has `confidence`, `source`, `standard_id`, `issue`, `suggestion`. Every `CheckResult` carries `verdict`, `review_reason`, `moment`, `audience`, `pipeline` metadata. The API response wraps this in an `EvaluationEnvelope` with `schema_version` and `warnings`. The ditto corpus schema carries `case_id`, `domain`, `source`, `source_context`, `source_screenshot`, `html_element`, `word_count`, `human_verdict`, `human_confidence`, `human_notes`, `review_status`, `suggested_category`, `suggested_confidence`, `suggested_notes`.

What gets added in this session:

*Per-standard versioning.* Each standard in `standards_library.json` gets a `version` field (starting at the library's current `4.6.1` at introduction; bumped per-standard when the rule text, examples, or content_type_notes change). Surgical additive patch — the existing file structure is preserved, only new fields are added. A `version_history` field (list of `{version, date, change_note}` entries) tracks revisions per standard. This replaces the current all-or-nothing library version with a mechanism the novel corpus's "as-of-revision" claims can actually check against. The library-level version continues to exist and remains the authoritative package version; per-standard versions are additive metadata, not a replacement.

*`related_standards` array on every violation.* When a violation trips standard X, the reviewer often needs context on adjacent standards (CLR-01 overlaps with PRF-11 on dismissive language; VT-02 overlaps with VT-05 on framing). The array lists standard IDs the LLM saw as nearby candidates and either rejected or applied.

*`ambiguity_flag` with typed reason.* When the classifier, moment detector, or standard selector is uncertain in a specific way, the flag captures the reason: `voice_mismatch_with_moment`, `standards_conflict`, `insufficient_context`, `situation_uncertain`. The flag is separate from `review_reason` on `CheckResult` — review_reason is one-per-evaluation, ambiguity_flag can attach to a specific hop.

*`rule_version` on every violation.* References the per-standard version (from the new versioning above) that was in effect when the evaluation ran. Makes every eval record reproducible as of a specific rule revision.

*`rationale_chain` as a structured object on `CheckResult`.* A list of hops — classify, detect_moment, filter, preprocess, scan, validate, merge — each with step name, inputs it saw, intermediate output, confidence, and the `rule_version` references it used. When Robo sees a wrong verdict, he can open the chain and pinpoint which hop went sideways without re-running the pipeline.

*Deferred:* `situation_features` as a cross-cutting dimension (Phase 9 pending refinement-log evidence). `minority_opinion_flag` (depends on Session 13's ensemble work).

**Artifacts.** Migration patch for `standards_library.json` adding `version` and `version_history` to each of the 47 standards (surgical; file structure preserved). Updated write path in `pipeline.py` populating `related_standards` and `ambiguity_flag` on violations. `rationale_chain` data structure in `models.py`, populated at each hop in `pipeline.py`. Updated API response contract with corresponding schema_version bump to 1.2.0 (additive, minor). Tests covering the new fields and their default behavior. Updated `ARCHITECTURE.md` documenting the per-standard versioning policy.

**Success criteria.** Every new evaluation event has all new fields populated. A targeted backfill populates recent events where deterministic recomputation is safe. CI fails if any classifier writes an event missing a required new field. Every standard in `standards_library.json` has a `version` field. The per-standard versioning is documented with a one-paragraph policy (bump rule, schema versioning analogy).

**Dependencies.** None — this is the foundation.

### Session 2: Typed review_recommended subtypes

**State:** EXTEND (Verdict enum exists; one of five subtypes populated)

**Goal.** Populate the remaining four subtypes on `review_reason` so the review queue becomes sliceable by uncertainty type.

**Scope.** The `Verdict` enum and `review_reason` field are already shipped in `models.py`. The current logic in `derive_verdict` populates `review_reason: "low_confidence"` when a violation's confidence falls below 0.7. The deferred subtypes are called out explicitly in the function's docstring. This session adds them: `standards_conflict` (two or more standards applied to the same moment returned different verdicts — richest signal for taxonomy refinement), `situation_ambiguity` (moment classifier confidence below 0.6 — routes to moment classifier backlog, not standards), `out_of_distribution` (input doesn't resemble training data — seeds of new moments or content types), `novel_pattern` (classifier confident but override rate on similar strings climbing over the last 30 days — drift signal, not uncertainty).

**Artifacts.** Extended `review_reason` string values. Subtype-specific emission logic in `pipeline.py`. Routing rules for each subtype in Session 8's review queue. Tests for each subtype path.

**Success criteria.** Every review_recommended event carries a specific subtype. The review queue can filter by subtype. No review_recommended event carries a generic fallback.

**Dependencies.** Session 1.

### Session 3: In-product signal instrumentation

**State:** NET-NEW

**Goal.** Capture richer override signals from real usage without nagging users.

**Scope.** Four instrumentation additions. First, the three-button verdict pattern replacing thumbs-up/down: *Agree*, *Disagree*, *Agree but I'm overriding anyway*. The third button surfaces the case where the tool is right but the user has justified reason to ship — which is exactly the high-signal item for review. Second, progressive rationale disclosure with instrumentation: default collapsed, one click to expand, log `rationale_expanded: true/false` and `time_to_action` (ms from verdict surfaced to user action). Third, `actor_role` capture where available from the surface (designer in Figma, engineer in CLI, PM in web app) — weighted signal, not gating. Fourth, the counterfactual triple: before string / ContentRX's proposed after / user's actual after, captured whenever the user rewrites a flagged string. When the user's string is neither the original nor the suggestion, flag the eval as `suggestion_rejected_alternative_applied` and store all three strings.

The four-quadrant behavior model derived from this instrumentation — pattern-match accept (accepted within 2s, never expanded), informed accept (expanded then accepted), informed reject (expanded then rejected — highest-information reject), reflex reject (rejected within 2s without expanding) — gets derived downstream from `rationale_expanded`, `time_to_action`, and `action`.

**Artifacts.** Updated verdict UI across Figma plugin, CLI output, web app, and MCP surface. Event schema additions for the new fields. Role-inference helper for each surface. Counterfactual-triple capture in the rewrite flow. Tests for each behavior quadrant's derivation.

**Success criteria.** Every verdict presented captures all four signals. A queryable report exists ("show me informed rejects on standard 17 this week"). The counterfactual triple is stored with enough metadata to reconstruct the review context.

**Dependencies.** Session 1 (schema must be in place).

### Session 4: Structured user override reasons and session-level aggregation

**State:** NET-NEW with vocabulary clarification

**Goal.** Capture user-facing override reasons in a parallel-but-distinct vocabulary to Robo's triage_category, and aggregate repeated-same-standard overrides in a session into a single signal.

**Scope.** Five structured user override reasons with optional single-line free text: *not applicable here* (the situation detector was wrong for my content), *standard too strict for this case* (the judgment feels wrong), *suggested fix is worse than my version* (the counterfactual is wrong), *I agree but I'm shipping anyway* (deadline-driven accept-but-override), *confusing, need more context* (the rationale didn't help). One required structured reason plus optional free text.

These reasons are user-facing and sit alongside the existing `triage_category` vocabulary from EVAL_PROTOCOL; they do not replace it. User override reasons inform UX, weighting, and which items escalate to Robo's queue; Robo's triage_category drives architectural responses (classifier work, standards library gap, audience/moment gating). During review, Robo reconciles the two: a user's "not applicable here" may, after review, become triage_category `context_gap` — but not always, and the translation is an explicit judgment call captured as part of Session 8's review flow.

Session aggregation: when more than N overrides on the same standard occur within a single session or PR (tunable, start at N=3), emit a single `standard_pushback` event that replaces the individual overrides in the review queue. Reviewer sees one item to investigate, not N similar items. The aggregate preserves the individual events for drill-down; it only changes what shows in the queue.

**Artifacts.** Override reason dropdown in all override surfaces. `standard_pushback` event type with aggregation logic in the write path. Review queue filter that hides the aggregated individual overrides and shows only the session-aggregate (with expand-to-drill-down). Documentation in `ARCHITECTURE.md` clarifying the two-vocabulary pattern. Tests covering the aggregation threshold and the dedup guarantee.

**Success criteria.** Override events carry a structured reason. Session-aggregate events replace individual duplicates in the queue. The review queue count drops meaningfully on test traffic that exercises the aggregation. The two-vocabulary pattern is documented with an example of a user reason mapping to a triage_category.

**Dependencies.** Sessions 1 and 3.

---

## Phase 2 — Golden set and eval gate

The forcing function that keeps the system aligned to Robo's taste as the model evolves. The existing three eval paths (library regression, novel diagnostic, industry real-world) are preserved intact; this phase adds a fourth.

### Session 5: Held-out golden set carve-out

**State:** REFRAME (three eval paths exist; fourth is a carve-out, not a new corpus)

**Goal.** Select a ~100-case held-out subset from the existing 334-case industry corpus as a blocking CI gate and `/accuracy` page denominator.

**Scope.** The existing corpus structure is preserved: `evals/industry/` keeps its six source-specific files (Kaiser 67, Stripe 52, Apple 83, Wells Fargo 50, Robinhood 44, MEDVi 38). `evals/novel_cases.json` keeps its 41 adversarial cases as the library regression gate. The library eval (standards_library.json examples) keeps its ≥98% regression threshold.

What's added: a held-out selection list stored at `evals/held_out/manifest.json` identifying ~100 cases drawn from the industry corpus with explicit selection criteria — distribution proportional to industry traffic, every moment represented by at least 5 items, every standard that reaches 80%+ graduation readiness represented by at least 3 items, cases whose verdicts have been confirmed at `human_confidence: high` only. The held-out cases remain in their original source files (no duplication); the manifest is a reference list. Selection criteria documented so a second Robo (or a senior content designer review) could reproduce the choice.

Retirement rules: when a standard retires, its held-out items stay in the manifest but are archive-flagged (they stop gating releases; they remain queryable for historical comparison). When a taxonomy split is approved through the refinement log, one item from each side of the split is added to the held-out manifest. Bounded growth target: 150 items held steady. Past that, retire the 10 oldest low-signal items before adding new.

**Artifacts.** `evals/held_out/manifest.json` listing selected case_ids with selection rationale. `evals/held_out/README.md` documenting the selection criteria and retirement rules. `tools/run_held_out.py` script that reads the manifest and executes the held-out subset (reuses existing eval runner).

**Success criteria.** 100 items in the manifest at session end. Every item has a documented selection reason. Running the held-out set against the current engine produces a reproducible kappa number. Retirement flow is exercised once on a test case.

**Dependencies.** Session 1 (per-standard versioning means held-out records can pin rule versions).

### Session 6: Held-out eval as a second CI gate

**State:** EXTEND (parity gate and library regression exist; add held-out to the same workflow)

**Goal.** Block any engine release that disagrees with a held-out golden verdict unless Robo explicitly approves the change.

**Scope.** The existing parity gate (`parity.yml`) and library regression (≥98% threshold) continue to run. This session adds a held-out run to the same workflow: every PR touching the engine, the moments, the standards, or the prompts runs the held-out 100 cases and computes kappa against the stored verdicts. Any disagreement fails the build and produces a diff report (case_id, expected verdict, candidate verdict, candidate rationale chain). Robo can approve the change with a signed commit prefixed `held-out-update:` that updates the golden entry with a reason. No environment-variable bypass; the only way past is an approved held-out update.

**Artifacts.** `.github/workflows/held_out.yml` (or extension of existing `parity.yml`). Diff report format. Documented approval ceremony (commit prefix convention, reviewer requirement). Integration into the existing CI dashboard.

**Success criteria.** A main-branch merge has the held-out gate in its history. An intentional regression on a test branch triggers the gate. An intentional held-out-update PR passes only when the update is real and approved.

**Dependencies.** Session 5.

### Session 7: Self-drift check

**State:** NET-NEW

**Goal.** Measure Robo's Cohen's kappa against past-Robo quarterly on a fixed panel, and use the result to recalibrate graduation thresholds automatically.

**Scope.** Quarterly re-labeling on an **80-case stratified panel** sampled across moments and content types. The 80-case figure derives from Cicchetti & Fleiss's 2k² minimum for a binary decision across the 13 moments with contingency margin. Items in the panel are 90+ days old, re-presented blind (Robo doesn't see his past verdict or rationale), new verdict captured, Cohen's kappa computed against stored historical verdicts.

The measured ceiling is the single most important number in the graduation ladder — Session 10's thresholds are expressed as ratios against it. The panel is stratified (not random) so the ceiling measurement doesn't drift on sampling noise from one quarter to the next.

**Measured-ceiling regimes and their consequences:**

- **Ceiling ≥ 0.90** (target met or exceeded): thresholds stay at calibrated defaults or rise proportionally. Ship normally.
- **Ceiling 0.85–0.90** (target missed, maturing): thresholds fall proportionally (autonomous 0.80–0.85; batch-approval 0.71–0.75), but the falling ceiling is diagnostic. Trigger a taxonomy stabilization review of any standards where self-drift disagreements clustered *before* autonomous graduations resume.
- **Ceiling < 0.85** (below Landis-Koch "substantial"): graduation frozen. Invest in the taxonomy refinement log until ceiling recovers. Do not ship new autonomous graduations.
- **Ceiling < 0.80** (McHugh "no confidence" zone): system enters degraded mode. No new autonomous graduations; existing autonomous standards re-reviewed in next cycle.

Instrument the sampling, the blind re-presentation UI (hides the historical verdict and rationale but preserves the input and context), the comparison report, and the automatic threshold-recalibration in the graduation metrics (Session 10).

**Artifacts.** `tools/drift_check.py`. Blind re-labeling UI in the review tool (extends Session 8's review surface). Agreement computation using Cohen's kappa against past-Robo, with 95% CI. Drift report format. Scheduled quarterly reminder. Automatic write-path from measured ceiling to Session 10's threshold-recalibration pipeline.

**Success criteria.** A first drift check has been run against the initial held-out set on an 80-case stratified panel. The measured ceiling is recorded with a 95% CI. Items where past-Robo and current-Robo disagree are logged with reasons; any standards implicated get flagged for refinement-log review. The measured ceiling automatically updates graduation thresholds via the Session 10 ratio formula.

**Dependencies.** Session 5.

---

## Phase 3 — Review queue and cadence

Making Robo's review time sustainable by batching and by rhythm. The Phase 2 annotation pattern from EVAL_PROTOCOL (batch by moment, clusters of 3, agree/override/skip with keyboard-driven flow) is reused as the review UI; what's new is applying it to the production override stream.

### Session 8: Production override review queue with batching

**State:** EXTEND (annotation pattern exists for corpus building; apply to production overrides)

**Goal.** A review surface where Robo reviews 50 production override items in 60 minutes without losing context, with queue ordering calibrated to system maturity.

**Scope.** The Phase 2 annotation workflow from EVAL_PROTOCOL (Amendment 2.0) is the UI substrate: cluster-of-3 items, agree/override/skip, keyboard-driven flow, optional free-text notes after each cluster. What changes is the data source and the batching order.

**Primary batching dimension: audience, provisionally.** The ditto roadmap eval showed five of five preprocessor violations in general-audience content were false positives. But the sample was 12 cases; the 95% CI on that concentration is wide. Session 8 retains audience as the outer dimension but adds a formal **re-test trigger at 50 annotated general-audience cases**: recompute the false-positive concentration against the naive expectation from volume share. Retain audience-first only if general-audience concentration exceeds 40% of false positives; otherwise drop audience as outer dimension and let the disagreement subtypes drive batching directly. Until the re-test, treat audience-first as a hypothesis under test, not a standing rule.

**Secondary batching is stage-dependent.** The queue ordering changes based on maturity of the auto-annotator's precedent index (from `tools/annotator_prompt.py`). The phase trigger is a count: **500 high-confidence tuples** in the precedent index, where a "tuple" is (standard_id, content_type, verdict) and "high-confidence" means 3+ precedents per the existing auto-annotator calibration.

*Early phase (index has <500 high-confidence tuples):* exploration-weighted ordering.

1. Audience (outer, provisional).
2. **Low-confidence novel combinations** from the precedent index. Cases where the auto-annotator has no matching (standard, content_type, verdict) tuple. Each approved review fills a new cell, compounding future value. Promoted to position 2 because active-learning theory supports exploration-first when the labeled pool is sparse.
3. **standards_conflict subtype.** Two or more standards applied to the same moment returned different verdicts — richest signal for taxonomy refinement.
4. **ensemble_disagreement subtype.** Scan/validate disagreement routed via Session 13's subtype.
5. **standard_pushback aggregates.** Session-level aggregations from Session 4.
6. **Calibration sample at 5% of queue.** Random sample of high-confidence verdicts to catch miscalibration. The 5% figure is bounded below by statistical power (minimum ~200 cases per quarter for 95% CI with 3% margin of error on a 5% miscalibration rate) and above by opportunity cost.

*Late phase (index has ≥500 high-confidence tuples):* exploitation-weighted ordering.

1. Audience (outer, provisional).
2. **standards_conflict subtype.** Promoted to position 2 because taxonomy bugs are the highest-remaining-value failure mode once the precedent index is well-populated.
3. **ensemble_disagreement subtype.**
4. **Low-confidence novel combinations.** Demoted: most cells are now covered; remaining uncertainty is more likely noise than information.
5. **standard_pushback aggregates.**
6. **Calibration sample at 10% of queue.** Raised from 5% because miscalibration is the dominant remaining risk once the index is no longer the bottleneck.

The 500-tuple threshold derives from a coverage calculation: ContentRX has roughly 47 standards × ~4 practical content types × 2 verdicts = 376 plausible cells, so 500 high-confidence precedents ≈ 1.3× baseline coverage with margin for moment-specific variations.

The queue UI presents one batch at a time with a batch summary at the end ("you agreed with 44, overrode 4, skipped 2; the 4 overrides suggest standard 17 may be too strict on error states — open refinement-log entry?"). The "open refinement-log entry" action writes a candidate to `taxonomy_refinement_log.md` in the existing format.

**Artifacts.** Review queue service that composes the batching dimensions with stage-awareness. Precedent-index-size monitor to drive the phase switch. Extension of the existing Phase 2 UI to accept production overrides as input. Batch-summary generation with pattern detection. Direct write-path from batch summary to refinement log candidate entries. Instrumentation for the audience re-test trigger (counter of annotated general-audience cases, automatic false-positive concentration computation at 50).

**Success criteria.** Robo completes a 50-item batch in under 60 minutes. Every action captured and routed. A candidate refinement-log entry is auto-drafted when a batch reveals a pattern. The phase switch from early to late happens automatically once the precedent-index count threshold is met. The audience re-test fires at the 50-case trigger with a clear keep-or-drop decision output.

**Dependencies.** Sessions 2, 4.

### Session 9: Review cadence dashboards

**State:** EXTEND (eval discipline and refinement-log rhythm exist; instrument and surface)

**Goal.** Make the review rhythm legible so Robo knows what's pending, what's urgent, and what's sliding.

**Scope.** Three cadence surfaces, all extending patterns that already exist informally:

*Daily 15-minute surface.* Top-of-queue items from Session 8, urgent flags from the last 24 hours (spiking override rates, ensemble disagreement storms, new out-of-distribution clusters), pending refinement-log candidates needing triage.

*Weekly 60-minute surface.* Rotates through the 13 moments on a schedule so every moment gets a deep review every 13 weeks. Shows override stream for that moment, existing refinement-log entries touching it, graduation readiness per standard in that moment.

*Monthly calibration surface.* Triggers the self-drift check (Session 7) on a rolling basis and shows running kappa against past-self.

Velocity instrumentation: time per batch, which moment produces most overrides, review-queue size trend, refinement-log candidate arrival rate.

**Artifacts.** Dashboards for each cadence. Moment-rotation scheduler. Review-velocity metrics. Weekly digest email (Resend, ties into BUILD_PLAN_v2.md Session 13 override-rate report).

**Success criteria.** Robo has a single daily landing page. The moment rotation is visible and pre-queues the next deep-review. Velocity metrics are stored for later trend analysis.

**Dependencies.** Sessions 7, 8.

---

## Phase 4 — Graduation ladder

From Robo-labels-everything to autonomous-with-approval. The single most important architectural commitment in the plan.

### Session 10: Graduation criteria and metric instrumentation

**State:** NET-NEW

**Goal.** Codify the criteria that govern when a standard promotes up a step. Thresholds are expressed as ratios against the measured self-drift ceiling (Session 7), so the system automatically recalibrates when the ceiling drifts. Criteria are AND-ed, not averaged.

**Scope.** Six criteria. All must be met for the corresponding promotion.

**1. Sample size.** Agreements count only cases with `review_status ∈ {approved, revised}` AND `human_confidence ∈ {high, medium}`. Pending, low-confidence, excluded, and flagged cases are out of the denominator.

- **Autonomous:** ≥ 500 agreements accumulated over the 4-week stability window.
- **Batch-approval:** ≥ 200 agreements.
- **Tightening modifier:** 100–200 agreements available → tighten required kappa by +0.02 to account for wider SE (per Garner 1991 on SE of kappa). Fewer than 100 agreements → standard cannot graduate regardless of kappa (this floor derives from Cicchetti & Fleiss's 2k² minimum).

**2. Kappa agreement rate.** Cohen's kappa, measured as system-vs-Robo agreement on the same denominator as sample size. Thresholds are ratios against the measured self-drift ceiling from Session 7:

- **Autonomous:** κ ≥ 0.94 × measured ceiling. At the 0.90 target, this equals κ ≥ 0.85.
- **Batch-approval:** κ ≥ 0.83 × measured ceiling. At the 0.90 target, this equals κ ≥ 0.75.

Multiplicative form chosen over additive ("ceiling minus X") because it scales naturally with measurement and communicates externally more cleanly. When the measured ceiling changes, thresholds update automatically.

**3. Raw agreement floor (McHugh guard).** Kappa can be artificially inflated by skewed marginals. Raw agreement is a second floor:

- **Autonomous:** raw agreement ≥ 80% (McHugh 2012's recommended minimum for reliable conclusions in health-related inter-rater work).
- **Batch-approval:** raw agreement ≥ 70%.

**4. MCC supplementation for low-prevalence standards.** Cohen's kappa has a documented prevalence paradox: under heavily skewed marginals, kappa can take low or negative values despite high observed accuracy (Chicco, Warrens & Jurman 2021; Delgado & Tibau 2019). For any standard whose observed positive-class prevalence on the 334-case industry corpus is **below 15%**, supplement kappa with MCC:

- **Autonomous:** MCC ≥ 0.70.
- **Batch-approval:** MCC ≥ 0.60.

Kappa remains the default metric for all other standards. MCC is a supplement for the rare-trigger regime, not a replacement.

**5. Production override rate.** Rate at which real users override the standard's verdicts, over the 4-week stability window:

- **Autonomous:** < 5%.
- **Batch-approval:** < 10%.

Override rate uses production override events from Session 4, weighted by `actor_role` (content-designer overrides weigh more than engineer overrides).

**6. Novel-case counterpart check (adversarial gate).** A standard's novel-case suite in `novel_cases.json` must contain a minimum of passing counterpart cases — text where the standard should NOT fire, structurally similar to text where it should. This tests reasoning vs pattern-matching per Gardner et al. (2020) contrast sets and McCoy et al. (2019) HANS methodology.

**Counterpart tier (by observed positive-class prevalence):**
- Prevalence <15%: **5 counterparts minimum.**
- Prevalence 15–40%: **8 counterparts minimum.**
- Prevalence >40%: **12 counterparts minimum.**
- Structurally complex rules (multi-conjunct conditions or moment-attribute-referencing): **add +3** to the tier minimum.

The tier scales inversely with evidence difficulty and directly with shortcut-learning risk. High-base-rate standards need more counterparts because the model has more surface-level signal to overfit on.

**Structural variation required.** At least two of three axes must be represented, and within-moment is mandatory:
- **Within-moment, within-content-type, different text (target ≥60%).** Finest-grain test; most discriminating.
- **Cross-content-type (target ≥25%).** Tests generalization across surface variation.
- **Cross-moment (target ≥15%).** Tests whether the rule respects its own moment weighting.

A standard with counterparts all in the same moment and content type cannot graduate to autonomous regardless of kappa.

**Counterpart pass rate:** the standard must achieve ≥ 80% pass rate on its counterpart suite. Per the McHugh floor and HANS literature, below 80% the shortcut-learning hypothesis cannot be ruled out.

**Hard-gate formulation.** All six criteria are AND-ed. A 0.95 kappa with 60% counterpart pass rate does not graduate — averaging hides the shortcut-learning failure mode precisely where it is most dangerous (McCoy et al. 2019 document 84% MNLI scores collapsing to near-zero on HANS).

**Rule-version-change policy** (governs what happens to counterpart credit when a standard's rule text changes via per-standard versioning from Session 1):

- **Semantic change** (rule now fires on different conditions, or decision boundary shifts): full counterpart reset; prior counterparts tested a different rule.
- **Wording-only change** (rephrase, clarity edit, example update; no change to what triggers firing): prior counterparts carry at 50% weight toward the tier minimum; fresh verification required for graduation.
- **Additive change** (new exception or carve-out): counterparts outside the new exception carry at full weight; counterparts inside need re-verification.

Classification of a change as semantic-vs-wording is owned by the taxonomy refinement log using the existing two-source rule.

**Stability window.** 4 weeks default. No sub-threshold week in the previous four. Graduations only considered when the metric has been stably above threshold, not when it just crossed.

**Instrumentation.** Per-standard kappa computed from the review queue's agree/override events, rolling 4-week window. Per-standard override rate from production traffic. Per-standard counterpart pass rate. Per-standard observed positive-class prevalence (determines which tier applies and whether MCC kicks in). Combined graduation-readiness score with all six criteria visible, stoplighted green/yellow/red.

**Artifacts.** `tools/graduation_metrics.py` implementing all six criteria. `graduation_status` table storing current level per standard (`robo_labels`, `batch_approval`, `autonomous`). Readiness report per standard showing each criterion's current value and the gap to threshold. Documentation in ARCHITECTURE.md of the denominator policy, the McHugh floor, the MCC supplementation rule, the counterpart tier, structural variation requirements, the hard-gate formulation, and the rule-version reset policy.

**Success criteria.** Every standard has a current graduation level and a readiness report showing all six criteria. The kappa computation matches a manual calculation on a 30-item sample to within rounding error. The counterpart check with tier-and-variation logic runs correctly against the current novel corpus. When a standard's prevalence crosses the 15% threshold, the readiness report automatically switches between kappa-only and kappa+MCC display. When Session 7's measured ceiling changes, the kappa thresholds in the readiness report recalibrate automatically.

**Dependencies.** Sessions 5, 7, 8.

### Session 11: Graduation UI and approval workflow

**State:** NET-NEW

**Goal.** One-screen approval for Robo when a standard is eligible to graduate.

**Scope.** When a standard crosses into eligibility on all criteria, a notification surfaces: "Standard 17 is eligible to graduate to Batch-Approval. Last 30 days: 847 predictions, kappa 0.79 against your verdicts, 7% user override rate, no sub-threshold weeks, 4 passing novel counterparts. Approve graduation?" One button. The underlying decision is already made by the data; Robo's approval is oversight, not re-derivation.

Same surface for graduation to Autonomous. The UI shows what will change: which review queues will stop seeing this standard's verdicts (moving to sampled audit instead), what the rollback trigger will be.

**Artifacts.** Graduation notification widget in the review dashboard. Approval endpoint. Immutable audit log of every graduation (standard, from level, to level, approver, timestamp, criteria snapshot at time of approval).

**Success criteria.** First graduation happens on the highest-kappa standard with the longest stability. The audit log captures it. The review queue composition changes as designed post-graduation.

**Dependencies.** Session 10.

### Session 12: Rollback and auto-demotion

**State:** NET-NEW

**Goal.** When a graduated standard's user-override rate spikes over a two-week window, it auto-demotes one step. No human action required for demotion.

**Scope.** Monitor rolling 2-week override rate on all graduated standards. If the rate exceeds the graduation threshold (breach of 10% for batch-approval, 5% for autonomous) for the full window, auto-demote one step. Notify Robo with the reason ("standard 17 override rate spiked to 12% over the last 14 days, auto-demoted from autonomous to batch-approval; re-graduation requires re-earning the criteria"). Re-graduation requires the full criteria again; no fast-path.

Separately, Robo can manual-demote or manual-suspend any standard at any time with a reason. Manual actions log to the same audit trail.

**Artifacts.** Rollback monitor running on the nightly metrics job. Auto-demotion code path with audit log. Manual demotion/suspend UI. Re-graduation runs the full criteria.

**Success criteria.** A simulated override spike on a test standard triggers the demotion. The audit log captures the reason. The review queue re-incorporates the demoted standard's evaluations.

**Dependencies.** Sessions 10, 11.

### Session 13: scan/validate disagreement as ensemble signal

**State:** REFRAME (existing pipeline is the first-pass ensemble)

**Goal.** Surface scan/validate disagreement as a first-class `ensemble_disagreement` subtype on review_recommended, without adding a third classifier.

**Scope.** The pipeline already runs two LLM passes: scan proposes candidate violations; validate confirms or rejects each one with `content_type_notes` injected. `PipelineMeta` already tracks `validated_confirmed` and `validated_rejected`. This session routes the disagreement signal to the review queue.

When validate rejects a scan candidate, emit a `review_recommended` event with `review_reason: "ensemble_disagreement"` and both predictions attached (scan's candidate reasoning, validate's rejection reasoning). The review queue batches these (per Session 8's priority order, third-tier). Per-standard disagreement rate is tracked as an additional graduation-readiness signal.

A third independent classifier (distilled smaller model, rule-based baseline) is deferred until the scan/validate disagreement data shows structural blind spots that a third voice would resolve. Starting simple matches "add complexity only when data justifies it"; scan/validate disagreement is the data we need to decide whether the third voice is warranted.

**Artifacts.** Disagreement router in `pipeline.py` emitting the new review event. Per-standard disagreement rate in graduation metrics. Documentation in ARCHITECTURE.md framing the validate pass as the first-pass ensemble.

**Success criteria.** Every validate-rejection produces a review_recommended event with both predictions. The review queue receives these items. Per-standard disagreement rate is visible in the graduation-readiness report.

**Dependencies.** Sessions 2, 8.

---

## Phase 5 — External signal acquisition

Ethical, transparent, attributed. Extensions to existing attribution infrastructure, not a parallel corpus.

### Session 14: Ethical framework and /ethics page

**State:** NET-NEW

**Goal.** Publish the five commitments and the opt-out mechanism before any external scraping happens at scale.

**Scope.** Ship `contentrx.io/ethics` with:

*Transparency.* A public `/sources` page that lists every design system, style guide, and OSS repo ContentRX has ingested, when it was last crawled, and how it contributes to the model.

*Attribution.* Examples drawn from public sources are cited with source, commit hash or URL, and license.

*Respect.* Robots.txt, rate limits, a named bot (`contentrx-research-bot`) with a contact URL. Projects that ask to be excluded are excluded, and signal derived from them is removed from subsequent training.

*License-awareness.* Permissive licenses (MIT, Apache, BSD, CC-BY) default-in with attribution. GPL code is not ingested as training data without case-by-case review. Source strings never reproduced verbatim as product output without attribution.

*PII avoidance.* User-submitted strings evaluated ephemerally by default. Stored evaluations are hashed and stripped of obvious PII. Override dataset carries no user identity, only role.

**Artifacts.** `/ethics` page. Opt-out email address with routing. Linked `/sources` page stub (populated by Session 19).

**Success criteria.** Page live before external crawl starts at scale. Opt-out email routes to a monitored inbox. Copy is in Robo's voice.

**Dependencies.** None (can run in parallel with Phase 1).

### Session 15: GitHub mining pipeline

**State:** NET-NEW

**Goal.** Extract before/after copy-change pairs from a curated allow-list of OSS repos as external training signal, strictly separated from production evaluations.

**Scope.** Allow-list of 20 repos known for content care: Radix UI, shadcn/ui, Headless UI, Vercel's public repos, Supabase, Linear's OSS artifacts, Cal.com, Raycast extensions, Sentry, PostHog, plus ten others. Expand slowly; each new repo gets a week of sampling before inclusion.

Cascade of filters. **File-type:** `.jsx`, `.tsx`, `.vue`, `.svelte`, translation files (`en.json`, `en-US.json`, `.po`, `.xlf`), markdown in `/docs` or `/content`, `.mdx`. **Diff-pattern:** only commits where the non-whitespace changes are string literals, JSX text nodes, or translation-value changes. **Commit-message (soft tag):** "fix typo," "clarify copy," "update empty state," "improve error message," "soften tone," "rewrite for clarity."

For each qualifying commit, extract `(old_string, new_string, file_path, commit_message, repo, license)`. Route through ContentRX's own classifiers. Agreement cases are training confirmations; disagreement cases are teaching moments or noise — Robo's review distinguishes.

Use GitHub GraphQL API, not scraping. Respect secondary rate limits. `contentrx-research-bot` user agent with contact URL. Cache aggressively.

**Artifacts.** `external_signal/github_miner.py`. Allow-list config at `external_signal/allow_list.yaml`. Separate `external_signal` database namespace — strictly separated from production eval table. Intent-tagger using commit-message patterns (aligned with the existing triage_category vocabulary; see Session 18). Weekly crawl schedule with incremental updates.

**Success criteria.** First 20-repo crawl completes. Extracted pairs pass through the classifier. Disagreement cases queued for Robo's review. Data stays in `external_signal` and never leaks into production evaluations.

**Dependencies.** Sessions 1, 14.

### Session 16: Extend design system `sources` attribution

**State:** EXTEND (field exists; 17 of 47 standards populated with "Mailchimp"; moments.py docstring cites 5 systems)

**Goal.** Populate the `sources` field on every standard with accurate attribution, and extend `moments.py` weights to credit systems not yet represented.

**Scope.** Three work streams, all surgical patches to existing files.

*Extend `sources` on all 47 standards.* Currently 17 of 47 carry `sources: ["Mailchimp"]`. Each standard gets audited against the 10 canonical systems (Polaris, Atlassian Design System, IBM Carbon, Adobe Spectrum, Microsoft Writing Style Guide, Salesforce Lightning, GitHub Primer, USWDS, Mailchimp, Intuit, plus Google Developer Documentation Style Guide, 18F Content Guide, GOV.UK Style Guide, Apple HIG where applicable). Each standard's text is read; the systems that articulated a similar rule are added to its `sources` array with an optional `aligns_with` or `diverges_from` qualifier. Surgical additive patch — field structure preserved, never replace the file.

*Extend `moments.py` weight attribution.* The docstring cites GOV.UK, Mailchimp, Stripe, Apple HIG, Microsoft Writing Guide as inspirations. Per-weight rationale strings are reviewed; the systems that directly informed each weight get credited in the rationale. No API change — only the prose in the `rationale` arguments of `MomentWeight` instances.

*Add systems not yet represented.* Polaris's composition-level empty-state guidance ("be encouraging," "explain the steps," "be action-oriented"), Atlassian's voice principles, Carbon's writing-for-technical-audiences guidance, Primer's accessibility patterns — each gets evaluated as a possible refinement-log candidate. Where they diverge from existing standards, the disagreement is captured as metadata on the relevant standard.

*Separate examples corpus.* Start `evals/examples_corpus/` as a distinct artifact holding "this, not that" pairs extracted from the design systems, keyed by `(moment, standard_id, source_system)`. This pre-builds a test set as a byproduct (matches Robo's guidance-vs-examples separation principle). The examples corpus is NOT part of `standards_library.json` and does NOT gate any CI; it's a reference artifact.

**Artifacts.** Updated `sources` arrays on all 47 standards (surgical JSON patch). Updated rationale strings in `moments.py`. `evals/examples_corpus/` with initial population from the 10 canonical systems. A disagreement map showing where systems differ from each other and how ContentRX's standard lands.

**Success criteria.** Every standard has a `sources` field reflecting actual influence. Every moment weight's rationale names its inspiration where applicable. The examples corpus has at least 50 entries. The disagreement map exists and is used in Session 35.

**Dependencies.** Session 1 (per-standard versioning lets attribution change track properly).

### Session 17 — COLLAPSED

**State:** COLLAPSE (merged into Session 16)

Session 17 in v1 was "remaining design systems." In v2, Session 16 covers all 10+ systems in one consolidated pass. No separate Session 17.

### Session 18: Commit-message intent tagging

**State:** NET-NEW with vocabulary alignment

**Goal.** Classify commit messages in the external signal stream into intent categories to prioritize review.

**Scope.** Conventional-commits-style prefixes (`docs:`, `fix:`, `i18n:`) combined with verbs like "clarify," "rewrite," "soften," "simplify," "reword." Build a small classifier (fine-tuned sentence-transformer plus regex fallbacks) tagging intent into categories: `typo_fix`, `clarification`, `tone_shift`, `restructure`, `i18n_motivated`, `unknown`. Use categories to prioritize which before/after pairs get closest review.

Vocabulary alignment: the intent classifier's categories are chosen to map cleanly to existing triage_category vocabulary. `typo_fix` → `correct`; `clarification` or `tone_shift` → potential `missing_standard`; `restructure` → `context_gap`; `i18n_motivated` → potential TRN-* category. The mapping is documented, not enforced — the intent is to give Robo a lens into what kind of signal each external pair represents.

Quality filter at the repo level: repos with a dedicated content-designer or technical-writer acknowledged in contributor files; repos with active i18n and translator pushback on source strings; repos where maintainers have written about content on their blog.

**Artifacts.** Intent classifier. Repo quality scorer. Integration with Session 15's GitHub miner. Documented intent-to-triage mapping.

**Success criteria.** Intent classifier reaches acceptable accuracy on a held-out sample of 200 hand-labeled commit messages. Quality scorer produces a visible ranking. The intent-to-triage mapping is referenced in review flows.

**Dependencies.** Session 15.

### Session 19: /sources page

**State:** NET-NEW but smaller than v1 scope (style guide corpus absorbed into Session 16)

**Goal.** Ship the public `/sources` page powered by the consolidated attribution metadata from Session 16.

**Scope.** Live page at `contentrx.io/sources` listing every design system, style guide, and OSS repo ContentRX has ingested. For each entry: last crawl timestamp, how it contributes to the model (moment weights / standard influences / examples corpus / training signal), its license, and a direct link to the opt-out path from Session 14's `/ethics` contact.

The page generates from the consolidated corpus metadata (Session 16's work) and from Session 15's external signal metadata. No hand-maintained lists.

**Artifacts.** Live `/sources` page. Generator that reads from the corpus metadata at build time.

**Success criteria.** Every external source is listed with its license, last crawl, and role. Opt-out path works end-to-end on a test request.

**Dependencies.** Sessions 14, 15, 16.

---

## Phase 6 — Product surface for the content model

Making the taxonomy visible and claimable as the moat. The docs site at `docs.contentrx.io` is live as of 2026-04-23 with 57 SSG pages; these are pages within it, not greenfield infra.

### Session 20: /model page

**State:** NET-NEW within existing docs-site

**Goal.** The taxonomy as a browsable asset.

**Scope.** A public page presenting the 13 moments as browsable cards, each linking to the moment's standards, each standard linking to its current version (Session 1's per-standard versioning), its example pairs (Session 16's examples corpus), its sources (Session 16's attribution), and its version_history changelog. Cross-references between related standards (Session 1's `related_standards` array is the basis). Filter by situation-like properties (destructive, permission-gated, compliance) via existing moment attributes. Search across standards.

Both a marketing asset (the taxonomy is visible) and a product asset (users can link to "the standard I'm being flagged on" in a PR comment).

**Artifacts.** `/model` route in docs-site. Generator rendering the page from canonical JSON so content stays single-sourced. Per-standard permalink structure (`/model/moments/destructive-action/standards/CLR-01`).

**Success criteria.** Every moment and standard has a permalink. Examples render inline with attribution. The changelog per standard is live.

**Dependencies.** Sessions 1, 16.

### Session 21: "Why this verdict" rationale-chain UI

**State:** NET-NEW (depends on Session 1's rationale_chain)

**Goal.** Every verdict offers an expandable rationale chain.

**Scope.** For each flagged violation, expose: moment detected, situation properties detected, standards applied (with rule_versions), and the `rationale_chain` as an expandable tree. One click to expand. Shows what was classified at each hop with what confidence.

Three jobs: surfaces the situation-awareness wedge visibly; lets users correct ContentRX if a situation was misdetected (upstream debugging before downstream complaint); teaches users the taxonomy as they use the product.

**Artifacts.** Expandable rationale-chain component across Figma plugin, CLI output, web app, MCP response. Links from rationale nodes to corresponding /model page entries.

**Success criteria.** Every verdict renders the chain on demand. Misdetection of a situation is a one-click feedback path routing to the review queue with subtype `situation_ambiguity`.

**Dependencies.** Sessions 1, 20.

### Session 22: "Moment detected" first-class UI

**State:** NET-NEW (surface only; CheckResult.moment is already populated)

**Goal.** Before presenting a verdict, surface the moment detection so users understand the tool's context-awareness.

**Scope.** Product says: "I noticed this looks like a destructive_action; I'm applying these three standards." `CheckResult.moment` is already populated by `detect_moment()`. The work is surfacing it in the UI and adding the correction path. When a user disagrees with the moment detection, the correction routes to the moment-classifier backlog (via Session 2's `situation_ambiguity` subtype on review_recommended), not the standards backlog.

**Artifacts.** Moment-detection banner in all verdict-presenting surfaces. Correction flow. Routing to moment-classifier backlog with the corrected label.

**Success criteria.** Every verdict with a detected moment shows the banner. Corrections route correctly. Moment-classifier accuracy is measurable and improvable.

**Dependencies.** Sessions 1, 21.

### Session 23: Taxonomy changelog page

**State:** NET-NEW

**Goal.** A public record of how the content model evolves.

**Scope.** Every taxonomy change — standard added, standard retired, standard-text revised (via Session 1's per-standard version_history), new moment, moment retired, refinement-log approval — lands on a public changelog with date, reason, before/after, and migration guidance for historical evaluations. Generator reads from the `version_history` arrays in `standards_library.json` and from the `Approved refinements` section of `taxonomy_refinement_log.md`.

**Artifacts.** `/model/changelog` page. CI step that requires a changelog entry when a standards file or moment taxonomy changes.

**Success criteria.** Every taxonomy change in the previous 30 days has a changelog entry. The page is linked from /model.

**Dependencies.** Sessions 1, 20.

### Session 24: /accuracy page

**State:** NET-NEW

**Goal.** Real-time proof the tool is calibrated against a real expert, reported honestly with confidence intervals.

**Scope.** Public page showing three distinct numbers that must not be conflated:

1. **Measured system kappa** (system vs Robo's held-out golden verdicts from Session 5) with 95% CI, broken down by moment and standard, with a sparkline per dimension.
2. **Measured self-drift kappa** (Robo vs past-Robo from Session 7's quarterly panel) with 95% CI. This is the expert ceiling and sets the graduation thresholds.
3. **Design target κ = 0.90** stated separately as a design assumption. Never a composite "accuracy score."

Graduation-ladder status for each standard (Session 10's `graduation_status`). Honest failure mode disclosure: known over-triggers, known misses, standards whose novel-counterpart check hasn't been populated yet, standards where observed prevalence triggers MCC supplementation. Current phase of the review queue (early vs late per Session 8's precedent-index count).

The reporting format follows Model Cards guidance (Mitchell et al. 2019): measured metrics with intervals, disaggregated by relevant factors, no single-point metrics presented as population truths.

**Artifacts.** `/accuracy` page pulling live metrics from graduation instrumentation and the Session 7 drift-check output. Three distinct metric blocks (system kappa, self-drift kappa, design target). Sparklines per moment and per standard. Graduation-ladder overview. Failure-mode section. Current-phase indicator for the review queue.

**Success criteria.** Page renders live data. The three numbers (measured system κ, measured self-drift κ, design target) are visually distinct and separately labeled. 95% CIs render correctly. When Session 7 re-measures the ceiling, the displayed ceiling updates within 24 hours. No composite "accuracy score" anywhere on the page.

**Dependencies.** Sessions 7, 10, 11.

---

## Phase 7 — Marketing narrative and case studies

The content model as secret sauce made legible through product and story.

### Session 25: Positioning wedge copy

**State:** NET-NEW

**Goal.** Replace the landing-page placeholder with copy articulating situation-aware review and judgment calls as the wedge.

**Scope.** Two positioning angles, both core.

*Situation-aware.* "Your tool for error states, empty states, permissions flows, destructive confirmations, and the other moments where copy stops being decoration and starts being the product. Engineers and PMs without content-design training can't hold all the context. ContentRX holds it for them."

*Judgment calls.* "A senior content designer looks at an error message and sees whether it owns the failure or blames the user. That's not a rule you can look up — it's pattern recognition built from years of practice. ContentRX encodes that pattern recognition."

Sharp contrast with the Grammarly/LanguageTool/Alex layer: "Those tools check that your sentence is grammatical and inclusive. ContentRX checks that your error message shouldn't be an error message at all, that your destructive confirmation names what will be destroyed, that your permissions button says request-access and not submit. That's a different job."

Stripe Radar analogy as the internal compass: Radar is a model, Stripe sells the model. ContentRX is a model; ContentRX sells the model.

**Artifacts.** Landing page copy on contentrx.io. "About the model" page featuring Robo's content-design background. Copy for /model, /accuracy, /sources, /ethics tying together.

**Success criteria.** Landing page replaces placeholder. Positioning reads as a content designer's voice.

**Dependencies.** Sessions 20, 24.

### Session 26: OSS case study #1

**State:** NET-NEW

**Goal.** Evidence for the wedge through a real run on a well-known OSS project.

**Scope.** Pick one OSS project with active design review (Linear's public repos, Cal.com, or similar). Contact maintainers for permission. Run ContentRX against the project's UI strings. Draft a blog post focused on judgment calls a generic linter would miss — error messages that blame the user, permissions buttons that should be specific verbs, empty states that aren't encouraging. Publish with maintainer attribution and links to any resulting PRs.

**Artifacts.** Blog post. Linked PRs. Supporting social post.

**Success criteria.** Post published with maintainer approval. At least three judgment-call examples clearly articulated as distinct from rule-based catch.

**Dependencies.** Session 25.

### Session 27: OSS case study #2

**State:** NET-NEW

**Goal.** Second evidence piece, different domain.

**Scope.** Pick a second OSS project in a different category. Same process as Session 26.

**Artifacts.** Second blog post. Linked PRs. Social.

**Success criteria.** Second post published.

**Dependencies.** Session 26.

### Session 28: OSS case study #3 and aggregation post

**State:** NET-NEW

**Goal.** Third evidence piece with optional aggregation into a "state of" post.

**Scope.** Third OSS run. Optionally aggregate findings across all three projects into a "State of UI copy in OSS" post.

**Artifacts.** Third blog post. "State of" aggregation post.

**Success criteria.** Three case studies shipped. Aggregation post exists if findings cluster into patterns worth naming.

**Dependencies.** Session 27.

### Session 29: Generation-layer lead

**State:** NET-NEW

**Goal.** Shift the marketing lead surfaces to where copy is increasingly written.

**Scope.** Lead with MCP in Claude Code and Cursor, the CLI, and the GitHub Action. Figma plugin reframed as a design-time checker, not the flagship. Matches the reality that content standards enforcement is moving upstream into the generation layer.

Rewrite homepage, install pages, docs structure to lead with generation-layer surfaces. Figma plugin sits alongside, not above.

**Artifacts.** Updated contentrx.io structure. Updated /docs hierarchy. New copy across install and landing surfaces.

**Success criteria.** First-time visitor sees MCP/CLI/GitHub Action as primary surfaces. Figma plugin available and documented but not leading.

**Dependencies.** Session 25.

---

## Phase 8 — Team features and active learning

Monetization surface and a second signal stream beyond overrides.

### Session 30: Team golden sets

**State:** NET-NEW (on BUILD_PLAN_v2 roadmap as Session 14 but not shipped)

**Goal.** Let paying teams extend ContentRX's core model with hand-curated examples without touching shared standards.

**Scope.** BUILD_PLAN_v2.md Session 14. Teams create a golden-set extension: "our product writes in this voice; here are 50 hand-curated examples." Evaluations on team surfaces short-circuit to the stored verdict when an input matches a team golden entry. Team golden sets are private; the core model stays stable and shared.

Architecture: team golden sets live in a separate namespace, never leak signal back into the core model without Robo's explicit approval (which is an opt-in, attributed action from the team).

**Artifacts.** Team golden set data model. UI for team-level curation. Short-circuit evaluation path. Team-facing documentation.

**Success criteria.** A team can create, grow, and use a golden set. Verdicts short-circuit correctly. Core model remains untouched.

**Dependencies.** Session 5.

### Session 31: Active elicitation prompts feeding the precedent index

**State:** EXTEND (auto-annotator precedent index exists; add paired-preference as a new precedent source)

**Goal.** A second signal stream beyond overrides — pairwise preference data that feeds the existing precedent index.

**Scope.** Periodically (weekly per user, opt-outable) surface a 60-second paired-preference prompt: "Help calibrate ContentRX. Which of these is better for a destructive confirmation?" with two hand-picked strings. Three pairs per session. Pairwise comparison is easier for humans than absolute-scale scoring and produces robust preference signal.

The accumulated pairs write to a `preferences` table. The auto-annotator's precedent index (from `tools/annotator_prompt.py` and `tools/auto_annotate.py`) treats these as a second precedent source — alongside existing approved annotations — when computing `suggested_confidence`. A standard/content_type/verdict tuple with many aligned pairwise preferences scores high; one with conflicting preferences scores medium or low.

**Artifacts.** Paired-preference UI. Scheduler with opt-out. `preferences` table. Extension to the auto-annotator's precedent index to consult preferences.

**Success criteria.** Prompts surface on schedule. Opt-out respected. Preference dataset accumulates usable pairs. The auto-annotator confidence calibration shifts measurably after the preference source is added.

**Dependencies.** Sessions 1, 3.

### Session 32: Preference-informed suggestion ranking

**State:** SMALL EXTEND

**Goal.** Use accumulated preferences to rank counterfactual suggestions.

**Scope.** When the model proposes multiple possible rewrites for a flagged violation, rank them using the accumulated preference data from Session 31. A proposal that aligns with prior expressed preferences on similar (moment, standard) contexts ranks higher. This is a small extension of Session 31's precedent-index work — applying the preferences to suggestion generation rather than only to confidence calibration.

Kept conservative: preference data informs suggestion ranking and counterfactual quality, not the verdict classifier itself. Expand scope only if the data is clean enough.

**Artifacts.** Preference-informed ranker for counterfactual suggestions. Report showing preference-vs-suggestion agreement per moment.

**Success criteria.** Counterfactual-suggestion quality improves measurably on a held-out eval set once preference data is incorporated.

**Dependencies.** Session 31.

---

## Phase 9 — Taxonomy stewardship

The ongoing rhythm that keeps the content model alive and correct. The manual process exists (`taxonomy_refinement_log.md`, eval discipline section of ARCHITECTURE.md); this phase automates around it.

### Session 33: Taxonomy review cadence instrumentation

**State:** EXTEND (manual discipline exists; instrument and schedule)

**Goal.** Instrument and schedule the weekly, monthly, quarterly, and annual taxonomy-review rhythms that exist informally today.

**Scope.** *Weekly:* surface-level review of the override stream (Robo's daily check aggregates into a weekly pattern; Session 9's dashboard surfaces it). *Monthly:* one deep moment review, rotating through the 13 over the year. *Quarterly:* taxonomy review combined with Session 7's 80-case stratified drift check — recompute the measured self-drift ceiling, recalibrate graduation thresholds via Session 10's ratio formula, audit standards that triggered self-disagreement, evaluate graduation candidates and retirement candidates. *Annually:* full corpus audit per Session 36 — re-label a random sample of old evaluations under the current schema and check for long-term drift patterns that the quarterly cadence would miss.

The quarterly cadence is the load-bearing one. Graduation thresholds depend on the measured ceiling, so a year of drift between measurements could leave thresholds significantly out of calibration. The quarterly 80-case panel keeps the recalibration tight without imposing unsustainable review burden.

**Artifacts.** Scheduled reminders per cadence. Dashboards for each (weekly override stream summary, monthly moment-deep-review landing page, quarterly taxonomy-review template, annual audit template). Surfaces draw from existing instrumentation (Sessions 8, 9, 10) — this session is orchestration, not net-new dashboards.

**Success criteria.** First full cycle of each cadence has run. Outputs of each cycle feed the next.

**Dependencies.** Sessions 7, 9.

### Session 34: Automated candidate detection for the refinement log

**State:** AUTOMATION (manual process exists; automate candidate detection)

**Goal.** Nightly detection of patterns that might warrant a refinement-log entry, writing candidates to the log in the existing format for Robo to triage.

**Scope.** The refinement log's decision criterion, entry structure, implementation path, and open/approved/declined organization are already working. What's missing is automation around candidate detection. This session adds a nightly job that scans for:

*Retirement candidates.* Standards firing rarely (under 0.5% of evaluations for 90 days). Standards with high production override rate (>30% over 30 days). Standards subsumed by a more recent standard (no unique fires in 30 days that aren't also caught by a newer standard).

*Refinement candidates.* Recurring override patterns on a single standard that can't be fixed by adjusting content_type_notes. Standards-conflict clusters (Session 2's subtype) repeated across sources.

*Moment/content-type candidates.* Out-of-distribution clusters (Session 2's subtype) that have accumulated 5+ cases in 60 days from 2+ distinct sources. The two-source minimum matches the refinement log's discipline (button_cta split not added because only one source).

The job writes candidate entries to a new `Proposed refinements (auto-detected)` section of `taxonomy_refinement_log.md`. Each entry uses the existing format (current category, proposed split or change, triggering cases, architectural consequence, verdict: pending). Robo triages candidates during the weekly review rhythm.

**Artifacts.** `tools/refinement_candidate_detector.py`. Scheduled nightly job. Documentation in ARCHITECTURE.md explaining that the log now has a third section for machine-proposed candidates, distinct from Robo-proposed ones.

**Success criteria.** Job runs nightly. Candidates appear in the log in proper format. A first candidate triage during weekly review either approves the candidate as an open refinement, declines it (moves to declined section with reason), or defers (stays pending for more data).

**Dependencies.** Sessions 8, 9.

### Session 35: Conflicting-standards disagreement map

**State:** EXTEND (sources field exists; add disagreement metadata)

**Goal.** Make the "Robo's synthesis, not weighted average" pattern legible in the product.

**Scope.** Extends Session 16's attribution work. Where Polaris says one thing, Material says another, and Robo's synthesis is a third way, the standard carries an `influences` sub-field recording the relationship ("aligns with Polaris; diverges from Material in preferring specific verbs over OK/Cancel"). This is additive to the `sources` field — `sources` says what influenced; `influences` says how the influences relate.

Rendered on /model (Session 20) so users see whose judgment they're opting into. A linting check rejects a standard whose text is suspiciously close to a known external source without attribution — catches lightly-edited paraphrases before they ship.

**Artifacts.** `influences` sub-field populated for every standard with external inspiration. Rendering on /model. Linting check for close paraphrase.

**Success criteria.** Every influenced standard carries its `influences` metadata. /model shows the influences transparently. At least one standard has "diverges from X because Y" documented as a deliberate choice.

**Dependencies.** Sessions 16, 20.

### Session 36: Annual taxonomy audit framework

**State:** NET-NEW

**Goal.** A durable annual review surfacing long-term drift and structural issues that the quarterly drift check cannot detect.

**Scope.** The quarterly drift check (Session 7) measures self-consistency on a fixed panel over 90-day intervals and drives automatic threshold recalibration. The annual audit operates alongside it, not instead of it, on a larger and older sample: re-label a random sample of 100 old evaluations (>1 year old) under the current schema, blind. Compute agreement with stored historical verdicts. Where current-Robo disagrees with past-Robo from a year ago, investigate whether the taxonomy evolved appropriately (intentional drift — a standard was refined) or whether the disagreement indicates taxonomy overfitting to recent cases (unintentional drift).

The two cadences answer different questions. The quarterly check answers "is the threshold correct for today?" The annual audit answers "has the system overfit to the year's labeled data?"

Generate a written audit report. Use findings to plan the year's taxonomy work and to inform whether the 0.90 design target ceiling should be reconsidered.

**Artifacts.** Audit template. Sampling code. Blind re-labeling surface (extends Session 7's). Report structure: standards with highest past/present disagreement, moments with most evolution, retired standards that might deserve reinstatement, new-moment candidates accumulated over the year, recommendation on whether the design target ceiling needs revisiting.

**Success criteria.** First annual audit runs and produces a report. Report drives the next year's taxonomy roadmap and includes an explicit statement on whether the 0.90 design target remains appropriate or should be revised.

**Dependencies.** Sessions 7, 33.

---

## Standing notes

**Splits only when they change downstream behavior.** Proposed standard splits are rejected unless the proposer shows the split causes at least one past verdict to flip on the held-out golden set. This principle applies to every Phase 9 decision and every refinement-log entry. The button_cta observation in ditto_cases is a case in point: one source, 36 cases is not sufficient evidence regardless of how visually striking the pattern.

**Guidance separate from examples.** Standards library keeps prescriptions in `standards_library.json` content; examples move to the separate `evals/examples_corpus/` artifact built in Session 16. The examples corpus is the eval test set as byproduct.

**Start simple; add complexity only when data justifies it.** No third ensemble classifier before scan/validate disagreement data (Session 13) reveals structural blind spots. No active elicitation before the override stream is mature (Session 31 depends on Phase 1 + Phase 3). No situation_features cross-cutting dimension until refinement-log evidence shows verdict-changing need.

**Never replace `standards_library.json` wholesale.** Every schema change is a surgical additive patch. Per-standard versioning (Session 1), extended `sources` (Session 16), `influences` sub-field (Session 35) — all surgical.

**Robo's voice in the model.** Standards texts, influences annotations, changelog entries, blog posts, case studies, positioning copy — all in Robo's voice. The authorship of the model is a feature. The content moat depends on it being legibly authored.

**Every session produces shippable code or content.** No research-only sessions. Every session ends with something merged or published.

**Kappa thresholds are ratios against the measured ceiling, not fixed numbers.** Autonomous graduation requires κ ≥ 0.94 × measured ceiling (= 0.85 at the 0.90 target) with raw agreement ≥ 80% per McHugh (2012). Batch-approval requires κ ≥ 0.83 × measured ceiling (= 0.75 at target) with raw agreement ≥ 70%. Denominator counts only cases with `review_status ∈ {approved, revised}` and `human_confidence ∈ {high, medium}`. Sample size floor: 100 agreements (below this, graduation is blocked regardless of kappa). When Session 7's quarterly measurement changes the ceiling, thresholds recalibrate automatically. Do not relax these to accelerate graduation.

**MCC supplements kappa for low-prevalence standards.** Cohen's kappa has a documented prevalence paradox (Chicco, Warrens & Jurman 2021; Delgado & Tibau 2019). For any standard whose observed positive-class prevalence on the industry corpus is below 15%, graduation requires MCC ≥ 0.70 (autonomous) or ≥ 0.60 (batch-approval) as a supplement to the kappa thresholds. Kappa remains the default everywhere else. MCC is not a replacement.

**Measured metrics and design targets are distinct.** The 0.90 self-drift target is a design assumption, not a measurement. Public reporting (Session 24's `/accuracy` page) shows measured system κ with 95% CI, measured self-drift κ with 95% CI, and the design target stated separately — never a composite "accuracy score." When measured ceiling diverges from target, thresholds move with the measurement, not with the target.

**Counterpart gate is hard, not averaged.** Autonomous graduation requires all of: counterpart floor met for the standard's base-rate tier (5/8/12 plus +3 for structural complexity), counterpart pass rate ≥ 80%, structural variation across at least two of three axes with within-moment mandatory, AND kappa threshold met. A high kappa with low counterpart pass rate does not graduate — that is precisely the shortcut-learning profile the adversarial literature (Gardner et al. 2020; McCoy et al. 2019) warns against.

**Training/production separation is absolute.** External signal (Phase 5) lives in a separate database namespace from production evaluations. No back-channel. The only path from external signal into the production model is via Robo's review and approval, and even then only the inference (extracted pattern) crosses the boundary, never the raw string.

**Opt-out is honored immediately.** Any opt-out request received through the /ethics channel results in same-week removal of the source from crawls and best-effort removal of derived signal from subsequent model updates. This commitment is non-negotiable.

**Two vocabularies, reconciled explicitly.** User override reasons (Session 4: *not applicable*, *too strict*, *fix is worse*, *shipping anyway*, *confusing*) and Robo's triage_category (existing: `correct`, `misclassification`, `hallucination`, `missing_standard`, `context_gap`) remain distinct. User reasons feed UX and weighting; triage_category drives architectural responses. Robo's batch review reconciles them item by item.
