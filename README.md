# Content standards checker

An open source linter for UX and UI copy. Checks content against a structured standards library using Claude as the reasoning engine.

Think ESLint, but for words.

## What it does

Paste a piece of UI copy — a button label, error message, tooltip, onboarding flow — and the checker evaluates it against 46 content standards covering clarity, voice and tone, consistency, accessibility, action-oriented writing, content structure, grammar and mechanics, inclusive language, and translation readiness.

You get a pass/fail verdict, the specific standards violated, and a suggestion for each. You decide what to fix and how — the tool flags problems, it doesn't rewrite your copy.

## Components

### Standards library (`standards/`)

A structured JSON file with 46 standards across 9 categories. Each standard has a rule, a correct example, and an incorrect example. Standards are tagged with metadata:

- `rule_type`: `hard` (mechanical, binary check) or `nuanced` (context-dependent, requires judgment)
- `checkable_from`: `plain_text`, `rich_text`, or `visual` — indicates what context is needed to evaluate the standard

### CLI (`cli/`)

A Python command-line tool for checking content from the terminal.

```bash
# Check a single string
python3 cli/checker.py "Click here to learn more"

# Interactive mode
python3 cli/checker.py -i

# JSON output
python3 cli/checker.py --json "Submit"
```

Requires an Anthropic API key set as `ANTHROPIC_API_KEY` in your environment.

### Eval suite (`evals/`)

Tests the checker against the standards library and a set of novel edge cases. Reports accuracy, false positive rate, standard ID accuracy, stability across runs, latency, and estimated cost.

```bash
cd evals

# Run library cases (3 passes by default)
python3 run_evals.py

# Run novel (generalization) cases
python3 run_evals.py --novel

# Filter by category
python3 run_evals.py --category GRM

# Include standards that require rich text or visual context
python3 run_evals.py --all
```

Current eval results (v3.1.1, Claude Sonnet):

- Library cases: 98.8% accuracy, 1.2% false positive rate
- Novel cases: 82.1% accuracy across 41 adversarial edge cases

### Figma plugin (`figma-plugin/`)

A Figma plugin that checks selected text layers in your designs. See `figma-plugin/README.md` for setup instructions.

## Standards coverage

| Category | Standards | Type |
|---|---|---|
| Clarity | CLR-01 through CLR-05 | Mostly nuanced |
| Voice and tone | VT-01 through VT-05 | All nuanced |
| Consistency | CON-01 through CON-05 | Mix of hard and nuanced |
| Accessibility | ACC-01 through ACC-07 | Mix (2 require rich text or visual context) |
| Action-oriented writing | ACT-01 through ACT-04 | All nuanced |
| Content structure | STR-01 through STR-06 | Mix (1 requires rich text context) |
| Grammar and mechanics | GRM-01 through GRM-05 | All hard |
| Inclusive language | INC-01 through INC-02 | Mix |
| Translation readiness | TRN-01 through TRN-07 | Mix |

## How it evaluates

The checker uses a system prompt that embeds the full standards library and instructs Claude to:

1. Identify the content type (button/CTA, error message, confirmation, tooltip, UI label, short UI copy, or long-form copy)
2. Check against standards with a high confidence threshold — if less than 90% confident something is a violation, it passes
3. Cite the specific standard ID, explain the issue, and suggest a fix
4. Give an overall pass/fail verdict using judgment, not a mechanical tally

## Roadmap

- Deterministic pre-processing layer for mechanical rules (Oxford comma, numerals, ampersands, capitalization) to improve accuracy on grammar and style checks without API calls
- Standards packs for specific industries and style guides (GOV.UK, Google, Microsoft)
- Multi-layer text checking in the Figma plugin
- `pip install` distribution via PyPI

## Contributing

See `CONTRIBUTING.md` for guidelines.

## License

See `LICENSE` for details.
