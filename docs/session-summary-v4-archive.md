# Content standards checker: session summary

## Where we're at

### What shipped (v4.0.0)

The content standards checker is a proper Python package with a 5-stage pipeline, installable via `pip install -e .`:

- A standards library (v4.0.0) with 46 standards across 9 categories, tagged with `rule_type`, `checkable_from`, `relevant_content_types`, `content_type_notes`, and `requires_multi_snippet`
- A 5-stage pipeline: classify → filter → preprocess + scan → validate → merge
- A deterministic pre-processing layer for mechanical rules (GRM-01 Oxford commas, GRM-04 ampersands, GRM-05 numerals, CON-03 date formats)
- An LLM-based content type classifier with heuristic fallback
- Content-type-specific standards filtering (86% fewer standards for buttons, 60% for confirmations)
- A validation pass that confirms or rejects each candidate violation with full context
- A batch handler for checking multiple strings with cross-snippet consistency detection
- A CLI with single-check, interactive, and batch modes
- A Figma plugin with embedded standards that checks selected text layers
- An eval suite with library (regression gate) and novel (accuracy diagnostic) modes
- 116 pytest tests across 6 test files, all passing
- Typed data contracts (dataclasses with type hints) for all function interfaces
- A standards audit document explaining every classification decision
- A content type mapping document with reasoning for every standard → content type assignment

### What the eval data tells us

**Library eval (v4.0.0): 100% accuracy across 86 cases**

Library mode runs with `skip_filter=True` — all standards, no content type context. This tests "does the system know its own rules" in the cleanest possible way. The deterministic preprocess layer now catches the mechanical violations (GRM-01, GRM-04, GRM-05, CON-03) that the LLM was previously missing.

- Accuracy: 100%
- False positive rate: 0.0%
- Standard ID accuracy: 100%
- Cost per run: $1.36

**Novel eval (v4.0.0): 91.9% accuracy across 41 cases × 3 runs**

Novel mode runs the full pipeline with hand-assigned content types per case. This tests real-world generalization — copy the checker has never seen, routed through the correct content type context.

- Accuracy: 91.9% average (90.2%, 90.2%, 95.1% across 3 runs)
- False positive rate: 14.3%
- Standard ID accuracy: 94.9%
- Stable passes: 35/41
- Stable fails: 2/41
- Unstable: 4/41
- Cost per run: $0.60

### The accuracy journey

| Version | Novel accuracy | False positive rate | Stable fails | Cost/run |
|---|---|---|---|---|
| v3.1.1 baseline | 82.1% | 19.0% | 7 | $2.06 |
| + preprocess | 86.2% | 19.0% | 5 | $2.06 |
| + full pipeline | 91.9% | 14.3% | 2 | $0.60 |

### What's working

The pipeline architecture delivers measurable improvements on every dimension:

- Deterministic preprocess catches all 4 mechanical rules (GRM-01, GRM-04, GRM-05, CON-03) at zero API cost, sub-millisecond
- Content type filtering reduced the prompt from 14,903 chars (all standards) to 3,217 chars (button) — 78% smaller. Fewer standards in the prompt means fewer opportunities for cross-standard false positives
- The validation pass clears false positives with content-type-specific context: "Your changes are saved" no longer gets flagged for passive voice because the VT-01 content_type_note tells the validator passive is acceptable in confirmations
- "New project" as a navigation label no longer gets flagged for ACT-01 (verb-led CTAs) because it routes through `ui_label` where the rule explicitly permits noun phrases
- Batch mode enables cross-snippet consistency checking (CON-01, CON-04, TRN-07) — standards that are impossible to evaluate on a single string
- API costs dropped 70% per novel eval run because filtered prompts use far fewer tokens

### What's still struggling

2 stable fails remain in the novel eval:

- **GRM-05 sentence-start exception**: "Twelve users are currently online." — the preprocess correctly passes it (sentence-start numbers can be spelled out), but the LLM flags it anyway from a different angle. Fixable with deterministic post-processing that suppresses LLM violations on standards the preprocess already cleared.
- **TRN-01 ambiguous pass**: "Because you updated your settings, your old preferences have been cleared." — uses the correct "because" instead of "since," but gets flagged. Cross-standard bleed from passive voice in the second clause.

4 unstable cases (correct 2/3 runs each): CLR-01 borderline technical, VT-01 passive with agent, VT-01 active pass, TRN-04 novel idiom. These are judgment-boundary cases where the LLM's confidence threshold sits right at the edge.

### What we learned about multi-stage AI systems

The biggest lesson from this session: building a pipeline that's smarter than the sum of its parts requires getting the seams right. Each stage individually works well. The integration failures came from:

1. **Misclassification cascading downstream.** The LLM classifier misidentified synthetic test strings ("Bar chart image" as a label instead of alt text), which caused the filter to exclude the relevant standard, which caused the scan to miss the violation. Fix: library evals bypass the pipeline and test the rules directly; novel evals use hand-assigned content types.

2. **The eval harness encoding assumptions about the pipeline.** When we derived content types from `relevant_content_types[0]` for novel cases, wrong assignments caused worse accuracy than the old single-call system. Fix: content types in novel cases are now hand-assigned based on what the input actually represents.

3. **API transience looking like pipeline failures.** A 529 overload during an eval run produced 29.3% accuracy that was entirely caused by failed API calls, not pipeline bugs. Fix: learned to check latency and cost as diagnostic signals before debugging code.

### What didn't work

**`[HARD RULE]` / `[NUANCED]` tags in the system prompt (v3.1.1 experiment):** adding rule-type differentiation made the model over-aggressive on hard rules. Accuracy dropped, false positives tripled, latency 4x'd. Reverted immediately.

**Deriving content types for novel evals from `relevant_content_types[0]`:** mapping "New project" → `button_cta` (because ACT-01's first relevant type is buttons) caused the scan to flag it for missing a verb. The input is actually a navigation label. Content type assignments for test cases need to describe what the input is, not which standard it tests.

**`short_ui_copy` as a universal content type for library evals:** the broadest type still excludes 4 standards (VT-05, ACT-01, ACC-03, STR-05), causing 77.9% accuracy. Library evals need the full rulebook, not a filtered subset.

## Architecture

### Pipeline stages

```
Input → Classify → Filter → Preprocess + LLM Scan → Validate → Merge → Result
```

1. **Classify:** LLM call (~50 tokens) or heuristic fallback. Reads content type taxonomy from the standards library so custom types from packs are automatically supported.
2. **Filter:** prunes standards to only those relevant to the detected content type. Surfaces `content_type_notes` for the validation pass.
3. **Preprocess:** deterministic regex checks for GRM-01, GRM-04, GRM-05, CON-03. Zero cost, sub-ms.
4. **LLM scan:** checks the filtered standards against the input. Smaller prompt = fewer tokens = fewer false positives.
5. **Validate:** second LLM call reviewing only the candidate violations. Confirms or rejects each one with content-type-specific context.
6. **Merge:** combines deterministic + validated LLM violations, deduplicates, produces verdict.

### Batch mode

For multi-string input (Figma multi-select, code scanner output):

1. Each item runs through the full pipeline individually
2. A consistency pass checks CON-01, CON-04, TRN-07 across all items as a set
3. Results include per-item verdicts + cross-snippet consistency violations

### Eval modes

- **Library eval:** `check_unfiltered()` — all standards, no classification, no filtering, no validation. Tests "does the system know its own rules." Gate: must be 100%.
- **Novel eval:** `check()` with hand-assigned content types — full pipeline. Tests real-world accuracy. Target: 90%+.

## The path forward

### Deterministic post-processing

Same pattern as preprocess, but suppressing instead of adding. When the preprocess confirms a standard passes (e.g., GRM-05 sentence-start exception), suppress the LLM's violation for that standard. Fixes the 2 remaining stable fails without touching the LLM prompt.

### Code scanner

File discovery → string extraction → batch handler. The batch handler is built. The remaining pieces:

- **File discovery:** glob patterns for JSX, TSX, HTML, template files
- **String extractor:** AST-based extraction for JSX/TSX, regex for HTML attributes and template literals. Each extracted string gets a file path and line number.
- **Output:** `ContentItem` list with source metadata, fed to `check_batch()`

### Standards packs

Extensible content type taxonomy is already in the standards library. A GOV.UK pack adds standards tagged for custom content types (`service_pattern`, `guidance_page`). The classifier reads the taxonomy from whatever's loaded.

Architecture: each pack is a JSON file following the same schema. `--pack gov-uk` on the CLI, or toggle in the Figma plugin.

### Figma plugin upgrade

The plugin currently checks one layer at a time. The batch handler enables multi-select: send all selected layers to `check_batch()`, get per-layer results plus cross-layer consistency violations. The `content_type_notes` and `relevant_content_types` fields also need embedding in the plugin's UI-side standards copy.

### Eval discipline

- Library eval: gate (must be 100%). Run on any standards or pipeline change.
- Novel eval: diagnostic (target 90%+). Run on pipeline changes and model upgrades.
- Novel test cases should be expanded as real users report false positives and false negatives.

### Open source and monetization

The tool is MIT-licensable with an open-core model:

- Free and open: CLI, base standards library, eval suite, batch mode, Figma plugin (single user)
- Paid tier potential: hosted version with team features, custom standards management, violation analytics across a design system, pre-built industry packs, Figma plugin with org-wide shared settings, code scanner integration

License choice matters — consider AGPL or BSL if commercial protection is important before larger companies fork the repo.

## Project structure

```
src/content_checker/           # Core library (pip installable)
  __init__.py                  # Public API: check, check_unfiltered, check_batch
  models.py                    # Typed data contracts
  pipeline.py                  # Single-string pipeline orchestrator
  batch.py                     # Batch handler + consistency checker
  classify.py                  # Content type classifier
  filter.py                    # Standards filter by content type
  preprocess.py                # Deterministic pre-processing
  validate.py                  # Validation pass
  standards/
    loader.py                  # Standards library path resolution
    standards_library.json     # 46 standards, v4.0.0
cli/
  main.py                      # CLI (single, interactive, batch modes)
figma-plugin/
  code.js                      # Figma sandbox thread
  ui.html                      # Figma UI with embedded standards
  manifest.json                # Plugin config
evals/
  run_evals.py                 # Eval runner (library + novel modes)
  novel_cases.json             # 41 adversarial test cases with content types
tests/
  conftest.py                  # Shared fixtures
  test_models.py               # Data contract tests
  test_preprocess.py           # Deterministic checks
  test_filter.py               # Content type filtering
  test_classify.py             # Heuristic classifier
  test_validate.py             # Validation pass structure
  test_batch.py                # Batch handler + file loading
pyproject.toml                 # Package config, dependencies, pytest settings
standards_audit.md             # Hard vs. nuanced classification reasoning
content_type_mapping_v2.md     # Content type → standard assignments with reasoning
README.md                      # Project overview
CONTRIBUTING.md                # Contribution guidelines
```
