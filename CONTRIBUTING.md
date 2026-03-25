# Contributing

Thanks for your interest in contributing. Here's how to get involved.

## Setup

```bash
# Clone and install in development mode
git clone https://github.com/your-username/content-standards-checker.git
cd content-standards-checker
pip install -e ".[dev]"

# Set your API key (needed for evals, not for unit tests)
export ANTHROPIC_API_KEY=sk-ant-...

# Run the test suite
pytest
```

## Ways to contribute

**Add or improve standards.** The standards library is the heart of this project. If you have content standards from your org (or ideas for universal ones), open a PR to add them to `src/content_checker/standards/standards_library.json`.

**Add novel test cases.** The novel eval suite (`evals/novel_cases.json`) tests whether the checker generalizes beyond its own examples. Edge cases, ambiguous copy, and content that's tricky to classify are especially valuable.

**Improve the deterministic layer.** The pre-processor in `src/content_checker/preprocess.py` catches mechanical violations without an API call. If you find a hard rule the LLM consistently misses, a regex-based check here is the fix.

**Fix bugs or improve UX.** If something doesn't work as expected in the CLI, Figma plugin, or library API, open an issue or submit a fix.

**Documentation.** If setup was confusing, the README was unclear, or you had to figure something out that should have been documented — that's a contribution.

## How to submit changes

1. Fork the repo
2. Create a branch (`git checkout -b your-branch-name`)
3. Make your changes
4. Run `pytest` — all tests must pass
5. If you changed the standards library, run the eval suite to verify accuracy
6. Open a pull request with a clear description of what you changed and why

## Standards library conventions

Every standard in `standards_library.json` requires these fields:

| Field | Required | Description |
|---|---|---|
| `id` | Yes | Category prefix + number (e.g., `CLR-06`, `ACC-08`) |
| `rule` | Yes | The standard in plain language — this gets embedded in the LLM prompt |
| `correct` | Yes | Example that clearly passes the rule |
| `incorrect` | Yes | Example that clearly violates the rule |
| `rule_type` | Yes | `hard` (mechanical, binary) or `nuanced` (context-dependent) |
| `checkable_from` | Yes | `plain_text`, `rich_text`, or `visual` |
| `relevant_content_types` | Yes | Array of content type IDs where this standard applies |
| `content_type_notes` | No | Object mapping content type IDs to evaluation guidance |
| `requires_multi_snippet` | No | `true` if the standard needs multiple strings to evaluate |

When adding a standard:

- Use the existing ID format: category prefix + sequential number
- Write the rule in plain language — avoid jargon about content design
- The correct example should clearly pass. The incorrect example should clearly violate.
- Avoid ambiguous examples — the checker is tuned to pass when unsure, so borderline cases reduce accuracy
- Assign `relevant_content_types` based on where the rule meaningfully applies. See `content_type_mapping_v2.md` for reasoning on existing assignments
- If the rule only applies differently (not excluded entirely) for a content type, use `content_type_notes` instead of excluding it

Valid content type IDs: `button_cta`, `error_message`, `confirmation`, `tooltip_microcopy`, `ui_label`, `short_ui_copy`, `long_form_copy`.

## Novel test cases

When adding cases to `evals/novel_cases.json`:

- Each case must have a `content_type` field specifying what kind of content the input represents (e.g., `confirmation`, `error_message`). This is used to route the case through the correct pipeline path during evaluation.
- Write cases that test generalization, not pattern matching. Use different vocabulary, sentence structures, and topics than the library examples.
- Include both expected-pass and expected-fail cases for each standard you test.
- Add a `note` field explaining what the case tests and why it's tricky.

## Project structure

```
src/content_checker/       # Core library — what gets imported
  pipeline.py              # check() and check_unfiltered()
  batch.py                 # check_batch() and consistency checking
  classify.py              # Content type classification
  filter.py                # Standards filtering by content type
  preprocess.py            # Deterministic pre-processing
  validate.py              # Validation pass
  models.py                # Typed data contracts
  standards/               # Standards library and loader
cli/                       # CLI entry point — not imported by the library
tests/                     # pytest suite — run with: pytest
evals/                     # Eval runner and test cases — costs API tokens
```

The library (`src/content_checker/`) should never import from `cli/` or `evals/`. The CLI and eval runner import from the library.

## Code style

- Python 3.10+ with type hints on all public functions
- Use dataclasses from `models.py` instead of raw dicts for function inputs and outputs
- `anthropic` is imported lazily inside functions that make API calls, so the library is importable without an API key
- No inline tests — all tests go in `tests/` using pytest
- Commit messages: use imperative mood ("Add standard for emoji usage" not "Added standard")
- JavaScript: the Figma plugin is vanilla JS with no build step — keep it that way

## Running evals

Evals cost API tokens. Run them only when something changes:

- Standards added or revised → run library eval (`python -m evals.run_evals --runs 1`)
- Pipeline code changed → run both suites
- Model version upgraded → run both suites
- Users report false positives/negatives → investigate with `--category` runs

Library eval is the gate (must stay at 100%). Novel eval is the diagnostic (tells you where to investigate, target is 90%+).

## Questions?

Open an issue. There's no question too small.
