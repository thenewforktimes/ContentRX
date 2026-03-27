
---

## Scoped for next session: auto-annotator tool

### What it does

Takes raw extracted content (output of `extract_content.py`) and pre-fills all annotation fields using the checker pipeline + an LLM annotation pass calibrated against existing human-annotated cases.

### Two-stage process

**Stage 1: Machine verdict.** Runs each extracted case through `check()` with the content type from the extractor. Fills in `standard_id`, `expected`, and `category` mechanically — if the checker says fail on GRM-04, the case gets `standard_id: GRM-04`, `expected: fail`, `category: Grammar and mechanics`.

**Stage 2: Calibrated human annotation.** A separate LLM call acts as a calibrated human annotator. It receives the extracted text, content type, checker's verdict and reasoning, and a calibration prompt built from annotation patterns in the existing 119 cases. Fills in `human_verdict`, `human_confidence`, and `human_notes`.

### Confidence threshold

Low confidence is the default for anything ambiguous. The auto-annotator should only mark `high` when the pattern has clear precedent in the existing cases — same standard, same content type, same verdict direction. Anything novel or borderline gets `low`. A false `high` that requires correction is worse than a `low` that turns out fine.

### Voice calibration

The annotation output must match the user's writing style. Specific patterns from the 119 cases:

- Lead with the verdict rationale in one sentence
- Cite evidence from the source when it exists ("the same page uses sentence case in the breadcrumb")
- Frame standard disagreements as revision signals, not errors ("GRM-04 should have an exception for headings")
- Don't hedge reasoning even when confidence is medium
- Clear, concise, human — reads like a content designer wrote it on a busy day

The calibration prompt should use 8–10 of the best annotations from the 119 cases as few-shot examples, not a generic "write like a content designer" instruction.

### CLI interface

```bash
cd ~/Desktop/content-standards-checker/tools
source venv/bin/activate

# Full pipeline: extract + annotate
python auto_annotate.py https://example.com --domain healthcare --org "Kaiser Permanente" --output ../evals/industry/new_cases.json

# Annotate an existing extracted file
python auto_annotate.py --input extracted_cases.json --output annotated_cases.json
```

### Files to build

| File | Location | Purpose |
|---|---|---|
| `auto_annotate.py` | `tools/` | CLI tool, orchestrates both stages |
| `annotator_prompt.py` | `tools/` | Builds the calibration prompt from existing cases |

### How context carries to the next chat

Three layers:

1. **Memory** — project summary and key constraints (never replace standards library, read ARCHITECTURE.md first)
2. **ARCHITECTURE.md** — in project root, describes package structure, data flow, conventions
3. **project_narrative.md** — session summaries documenting what shipped, what was learned, what's next

### Dependencies

Same as the checker — `anthropic` SDK. The extractor's `requests` and `beautifulsoup4` only needed if running the extract step inline.
