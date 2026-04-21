# Architecture

This document describes how the content standards checker is put together —
module boundaries, data flow through the pipeline, the design decisions
behind the non-obvious parts, and where to extend.

For the user-facing overview (what it does, how to run it), see
[README.md](README.md).

## Top-level layout

```
src/content_checker/       pip-installable library
  pipeline.py              single-string orchestrator (full pipeline + unfiltered)
  batch.py                 multi-item handler + cross-snippet consistency
  classify.py              content type classifier (LLM + heuristic fallback)
  filter.py                standards filter + content-type introspection
  preprocess.py            deterministic mechanical checks (VIOLATION/PASS/DEFER)
  validate.py              second LLM pass over candidate violations
  llm_json.py              shared parser for fenced JSON responses
  models.py                typed data contracts (dataclasses)
  standards/
    loader.py              library loader with packaged-data path resolution
    standards_library.json 46 standards across 9 categories (v4.0.0)
cli/
  main.py                  argparse front end (single / interactive / batch)
figma-plugin/              Figma plugin that uses the same standards
evals/
  run_evals.py             library (regression) and novel (accuracy) runners
  novel_cases.json         41 adversarial test cases
tests/                     pytest suite (unit-focused, no live API calls)
```

`cli/` is a sibling of `src/` rather than nested under the package because
the CLI is an application front end, not a library surface. It is made
importable during tests via `pythonpath = ["."]` in `pyproject.toml`.

## The five-stage pipeline

`content_checker.pipeline.check()` runs the standard flow. Each stage is a
separate function so callers can compose differently if needed — for
example, `check_unfiltered()` skips stages 2 and 4 for library evals.

```
                  ┌──────────────────────┐
  input text ───▶ │ 1. classify          │── detected content_type
                  └──────────────────────┘
                             │
                             ▼
                  ┌──────────────────────┐
                  │ 2. filter            │── subset of standards relevant
                  └──────────────────────┘    to this content type
                             │
               ┌─────────────┴─────────────┐
               ▼                           ▼
    ┌────────────────────┐      ┌────────────────────┐
    │ 3a. preprocess     │      │ 3b. LLM scan       │
    │  (deterministic)   │      │  (nuanced rules)   │
    └────────────────────┘      └────────────────────┘
               │                           │
               │   VIOLATION / PASS        │ candidate violations
               │                           ▼
               │               ┌────────────────────┐
               │               │ 4. validate        │ content-type notes
               │               │  (LLM, yes/no)     │ shape the bar
               │               └────────────────────┘
               │                           │
               ▼                           ▼
                  ┌──────────────────────┐
                  │ 5. merge             │── preprocess wins conflicts;
                  └──────────────────────┘    PASS suppresses LLM hits
                             │
                             ▼
                       CheckResult
```

### Stage 1: Classify

Selects one of seven content types (`button_cta`, `error_message`,
`confirmation`, `tooltip_microcopy`, `ui_label`, `short_ui_copy`,
`long_form_copy`). An LLM call is preferred; a zero-cost heuristic in
`classify.classify_heuristic()` is the fallback when no API key is
available or the LLM call fails. Callers can also pass
`content_type="..."` to skip this stage entirely — useful when the source
already knows the type (Figma layer roles, batch JSON metadata).

### Stage 2: Filter

`filter.filter_standards()` returns a pruned copy of the standards library
keeping only standards where the detected content type appears in
`relevant_content_types` and `checkable_from == "plain_text"`. A button
drops from 46 standards to 6. Filtering is the single biggest lever for
reducing false positives and API spend.

`active_notes` is collected here as a side effect: for each standard that
has a `content_type_notes` entry for the detected type, a `{standard_id,
note}` pair is added. These notes are passed to the validation stage so it
can apply context-specific guidance (e.g., "passive voice is acceptable in
confirmations").

### Stage 3a: Deterministic preprocess

`preprocess.run_preprocess()` runs 13 mechanical checks — Oxford commas,
ampersands, sentence-start numerals, date formats, double spaces, straight
vs. curly quotes, and so on. Every check returns one of three outcomes:

- **VIOLATION** — definite problem, promoted to the final violation list
- **PASS** — definitely fine for this standard; the LLM must not override
- **DEFER** — can't tell without nuance; LLM decides

Each check only emits VIOLATION when it is certain; anything judgmental
defers. This asymmetry is the reason the preprocessor can be trusted to
override the LLM at the merge stage.

### Stage 3b: LLM scan

`pipeline._llm_scan()` sends the filtered standards plus the input text to
Claude with a system prompt that instructs: only flag unambiguous
violations, default to pass, respond in strict JSON. Output is parsed by
`content_checker.llm_json.parse_llm_json`, which tolerates the occasional
markdown code-fence wrapping and returns `None` on any parse failure so the
caller picks the fallback.

### Stage 4: Validate

`validate.validate_candidates()` makes a second, focused LLM call that
reviews each candidate from stage 3b individually and emits a
confirm/reject verdict. The validation prompt is shorter than the scan
prompt — it reads the candidate list, the original text, and any active
content-type notes, and applies a high-bar "when in doubt, reject" rule.
Candidates the preprocessor already decided on are never passed here.

This stage is what dropped the false-positive rate from 19% (v3.1.1) to
14.3% (v4.0.0).

### Stage 5: Merge

Three rules:

1. Preprocessor VIOLATIONs always make it through.
2. LLM violations are excluded when their `standard_id` appears in either
   `preprocess_ids` (preprocessor already flagged it, don't duplicate) or
   `suppressed_ids` (preprocessor PASSed the same standard and is
   authoritative).
3. `passes` is the set of standards the LLM called out as passing, minus
   any standard that ended up in the final violation list.

`suppressed_ids` is carried through on `preprocess_violations` as an
attribute on the `_ViolationList` subclass defined in `preprocess.py`.
This keeps the merge step type-compatible with a plain list while
preserving the extra metadata — no callers need to know the subclass exists.

## Batch mode

`batch.check_batch()` runs each item through the per-item pipeline, then
makes one additional LLM call for cross-snippet consistency against the
standards marked `requires_multi_snippet` in the library (CON-01, CON-04,
TRN-07 today). Consistency issues — terminology switching, inconsistent
verbs, synonyms — cannot be detected from a single string, which is why
they live outside `pipeline.check()`.

## Data contracts

Everything flows through typed dataclasses in `models.py`: `Violation`,
`PassedStandard`, `PipelineMeta`, `CheckResult`, `ContentItem`,
`ItemResult`, `ConsistencyViolation`, `BatchResult`, `TokenUsage`. Each
has a `to_dict()` for JSON output; `TokenUsage` overloads `__iadd__` so
the pipeline can accumulate API usage across stages with `total += usage`.

No stage takes or returns a raw dict. This is deliberate — it keeps
refactors local.

## Standards library

`standards/standards_library.json` is the authoritative knowledge source.
Every standard has:

- `id` — stable identifier (e.g., `GRM-04`)
- `rule` — the rule in plain language
- `correct` / `incorrect` — examples, used verbatim in the system prompt
- `rule_type` — `hard` (mechanical) or `nuanced` (judgment)
- `checkable_from` — `plain_text`, `rich_text`, or `visual`; today only
  `plain_text` standards are active
- `relevant_content_types` — which content types this standard applies to
- `content_type_notes` (optional) — per-type evaluation guidance used in
  the validation stage
- `requires_multi_snippet` (optional) — true iff the standard needs batch
  mode to evaluate

Adding a standard is purely a JSON edit. The library is bumped on
semantic-meaningful changes; code should tolerate unknown fields.

## Input validation and guardrails

Two guardrails sit at the boundary between user input and the API:

1. **`pipeline._validate_text_input`** (`MAX_CONTENT_LENGTH = 100_000`
   chars) rejects oversized strings at every public library entry point.
   This prevents a pathological input from producing a prompt that blows
   through the model's context window and bills accordingly.
2. **`cli.main._load_batch_file`** refuses anything that is not a regular
   file under the `MAX_BATCH_FILE_SIZE` cap with a supported extension
   (`.json` or `.txt`). Malformed JSON raises a clear error instead of
   silently falling back to line-by-line parsing, which was the previous
   behavior and would have sent arbitrary file contents to the API.

Secrets are never accepted as arguments; the Anthropic SDK reads
`ANTHROPIC_API_KEY` from the environment.

## Testing strategy

Tests are **structural, not integration**. No Anthropic API calls happen
during `pytest` — stages that require a live model are either skipped
(e.g., the classify LLM path falls through to the heuristic when no key
is set) or patched in the test (e.g., `cli.main.check` in `test_cli.py`).

Eval quality lives in `evals/run_evals.py` instead:

- **library evals** — 86 synthetic cases, one per standard, used as a
  regression gate. Uses `check_unfiltered` so the full rulebook is applied.
- **novel evals** — 41 hand-written cases that exercise judgment-boundary
  behavior. Uses the full pipeline including filtering and content-type
  notes.

Current numbers (v4.0.0, Claude Sonnet): 100% / 0% FPs on library, 91.9% /
14.3% FPs on novel.

## Extension points

- **New standard**: add a JSON entry; if it is mechanical, add a check
  function to `preprocess.py` and wire it into `run_preprocess()`.
- **New content type**: add it to `content_types` in the JSON, update the
  `relevant_content_types` fields on the standards that apply, and
  optionally add a `content_type_notes` entry.
- **New consistency standard**: set `requires_multi_snippet: true` on the
  standard; it will automatically be picked up by
  `batch._check_consistency`.
- **New LLM provider**: swap the `anthropic.Anthropic()` client in the
  three call sites (`pipeline._llm_scan`, `validate.validate_candidates`,
  `batch._check_consistency`) — the rest of the pipeline is provider-
  agnostic.
