# Content standards checker

An AI agent that checks UX copy against your content standards — inside Figma, from the command line, or in the browser.

Most organizations have content standards. Almost nobody follows them, because the standards live in a doc somewhere and the copy gets written in Figma. This tool closes that gap by bringing the check to where the writing happens.

**What it does:** you give it a piece of copy, it tells you whether it passes or fails your standards, which specific rules it violates, and how to fix it.

**How it works:** a structured standards library (29 rules across 6 categories) is embedded in a system prompt sent to Claude. The agent detects the content type, evaluates the copy against relevant standards, and returns a verdict with citations.

## Try it

### Figma plugin (recommended starting point)

The plugin reads selected text layers and checks them in place — no context-switching.

1. Clone this repo
2. In Figma desktop, go to **Plugins → Development → Import plugin from manifest…**
3. Select `figma-plugin/manifest.json`
4. Run the plugin and enter your [Anthropic API key](https://console.anthropic.com/)
5. Select a text layer and click **Check selected text**

Your API key is stored locally on your machine via Figma's client storage. It never leaves your device except to call the Anthropic API directly.

→ [Figma plugin docs](figma-plugin/README.md)

### Command line

```bash
cd cli
pip install anthropic
export ANTHROPIC_API_KEY=sk-ant-...

# Check a single string
python checker.py "Click here to learn more"

# Interactive mode
python checker.py --interactive
```

→ [CLI docs](cli/README.md)

### Web app

A React interface with auto-detected content types and a manual override. See [web/README.md](web/README.md) for setup.

## How accurate is it?

The eval suite tests all 58 cases from the standards library (29 standards × 1 correct + 1 incorrect example each). Results from 3 consecutive runs:

| Metric | Result |
|--------|--------|
| Accuracy | 100% across all 3 runs |
| Stable passes | 58/58 |
| Unstable cases | 0/58 |
| False positives | 0 |

→ [Full eval results](evals/results/stability_report.md)

These evals run against `claude-sonnet-4-20250514`. The system prompt is tuned to avoid false positives — the default verdict is pass, and only clear, unambiguous violations are flagged.

## Standards library

The standards are organized into 6 categories with 29 total rules. Each rule includes a correct example, an incorrect example, and a plain-language description.

| Category | Standards | What it covers |
|----------|-----------|---------------|
| Clarity | CLR-01 through CLR-05 | Plain language, sentence length, one idea per sentence |
| Voice and tone | VT-01 through VT-05 | Active voice, direct address, empathy in errors |
| Consistency | CON-01 through CON-05 | Terminology, casing, date formats, product names |
| Accessibility | ACC-01 through ACC-05 | Link text, color reliance, alt text, directional language |
| Action-oriented writing | ACT-01 through ACT-04 | Verb-led CTAs, specific verbs, positive framing |
| Content structure | STR-01 through STR-05 | Scannability, paragraph length, parallel structure |

The library is a single JSON file at [`standards/standards_library.json`](standards/standards_library.json). To customize it for your org, edit that file — all three tools read from it (the Figma plugin embeds a copy at build time).

## Repo structure

```
standards/              Shared standards library (single source of truth)
  standards_library.json

figma-plugin/           Figma plugin (no build step, load directly)
  manifest.json
  code.js               Sandbox thread — reads Figma layers
  ui.html               UI thread — API calls, results display

cli/                    Python CLI
  checker.py            Agent logic, content type detection, API calls

evals/                  Evaluation suite
  results/              Stability reports from eval runs

web/                    React web app (browser-based checker)
```

## Architecture

The core agent logic is the same across all three surfaces:

1. **Content type detection** — auto-classifies the input as a button/CTA, error message, confirmation, tooltip, UI label, short UI copy, or long-form copy
2. **System prompt construction** — embeds the full standards library with correct/incorrect examples for each rule
3. **Evaluation with guardrails** — the prompt is tuned to only flag clear violations at >90% confidence, read text literally (no hallucinated characters), and default to pass
4. **Structured response** — returns JSON with verdict, violations (with standard IDs and fix suggestions), and a plain-language summary

The Figma plugin adds a layer on top: a sandbox thread reads selected text layers from the Figma document and relays them to the UI iframe, which handles the API call and renders results.

## Why this exists

Content standards exist at most organizations. They get written, shared, maybe even celebrated — and then ignored. Not because people don't care, but because there's no mechanism to surface them at the point of creation. The copy gets written in Figma, and the standards live in a Google Doc three clicks away.

This project is an attempt to close that gap: check the copy against the standards in the place where the copy is being written, at the moment it's being written.

## Customizing the standards

The `standards/standards_library.json` file is the single source of truth. Each standard has:

- `id` — a unique identifier (e.g., `CLR-01`)
- `rule` — a plain-language description of the standard
- `correct` — an example that passes
- `incorrect` — an example that fails

To use your organization's standards, replace or extend this file. The eval suite will automatically test against whatever standards are in the library.

## License

MIT — see [LICENSE](LICENSE).

## Contributing

Contributions welcome. See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.
