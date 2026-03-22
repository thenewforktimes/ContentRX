# Contributing

Thanks for your interest in contributing. Here's how to get involved.

## Ways to contribute

**Add or improve standards.** The standards library is the heart of this project. If you have content standards from your org (or ideas for universal ones), open a PR to add them to `standards/standards_library.json`. Each standard needs an `id`, `rule`, `correct` example, and `incorrect` example.

**Improve the eval suite.** More test cases make the agent more reliable. Edge cases, ambiguous copy, and content that's tricky to classify are especially valuable.

**Fix bugs or improve UX.** If something doesn't work as expected in the Figma plugin, CLI, or web app, open an issue or submit a fix.

**Documentation.** If setup was confusing, the README was unclear, or you had to figure something out that should have been documented — that's a contribution.

## How to submit changes

1. Fork the repo
2. Create a branch (`git checkout -b your-branch-name`)
3. Make your changes
4. If you changed the standards library, run the eval suite to verify accuracy
5. Open a pull request with a clear description of what you changed and why

## Standards library conventions

When adding or editing standards in `standards/standards_library.json`:

- Use the existing ID format: category prefix + number (e.g., `CLR-06`, `ACC-06`)
- Write the rule in plain language — it gets embedded in the system prompt
- The correct example should clearly pass the rule
- The incorrect example should clearly violate it
- Avoid ambiguous examples — the agent is tuned to pass when unsure, so borderline cases will reduce accuracy

## Code style

- Python: follow the existing style in `checker.py` (straightforward, minimal dependencies)
- JavaScript: the Figma plugin is vanilla JS with no build step — keep it that way
- Commit messages: use imperative mood ("Add standard for emoji usage" not "Added standard")

## Questions?

Open an issue. There's no question too small.
