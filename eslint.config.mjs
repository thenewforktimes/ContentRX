import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({
  baseDirectory: __dirname,
});

/**
 * Pattern that flags raw Tailwind stone shades in className strings.
 * Stone shades are the underlying material the design tokens compile
 * from — they should only appear inside the token definitions
 * (`src/app/globals.css`) and the primitives that consume tokens
 * directly (`src/components/ui/*`).
 *
 * Anywhere else, stone-* is drift: it bypasses the warm-bronze token
 * system and re-introduces the inconsistency that PRs #308–#313 spent
 * an afternoon eliminating. The selector matches className literals
 * containing `(prefix:)?{bg|text|border|ring}-stone-{50..950}`,
 * including dark / hover / focus / placeholder modifier variants.
 *
 * Set as `warn` (not `error`) because ~250 legitimate hover-state
 * holdouts remain after PR 2's bulk migration — they're visually fine
 * but technically still raw stones. Warning gives them visibility for
 * incremental cleanup without bricking CI.
 */
const RAW_STONE_PATTERN =
  "Literal[value=/\\b(?:[a-z-]+:)?(?:bg|text|border|ring|outline|divide|placeholder|fill|stroke|caret|accent|decoration|from|to|via)-stone-\\d{1,3}\\b/]";

const RAW_STONE_MESSAGE =
  "Raw stone-* is drift — use the design tokens instead. " +
  "Common mappings: text-stone-{700,300} → text-default, " +
  "text-stone-{500,400} → text-quiet, text-stone-{900,100} → text-strong, " +
  "bg-{white,stone-950} → bg-raised, border-stone-{200,800} → border-line. " +
  "See src/app/globals.css for the full token list. " +
  "If you genuinely need a raw shade (rare — usually a hover state " +
  "in a button), add an // eslint-disable-next-line no-restricted-syntax " +
  "comment with a one-line reason.";

const eslintConfig = [
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    ignores: [
      // Recursive globs so build artifacts and dependency trees are
      // skipped wherever they live, including inside git worktrees
      // under `.claude/worktrees/<slug>/.next/` (which earlier surfaced
      // ~22k false-positive findings on local `npm run lint`).
      "**/node_modules/**",
      "**/.next/**",
      "**/out/**",
      "**/build/**",
      "**/dist/**",
      // Python venvs ship vendored JS (coverage HTML templates,
      // docutils slide themes) we don't own and shouldn't lint.
      "**/.venv/**",
      "**/venv/**",
      "**/__pycache__/**",
      "**/.pytest_cache/**",
      "next-env.d.ts",
      // git worktrees live under .claude/. Each worktree carries its
      // own copy of the source — linting them duplicates findings and
      // catches stale artifacts. Run lint in the worktree itself if
      // you need to lint that branch.
      ".claude/**",
      // docs-site is its own Next.js project with its own lint surface;
      // running the main app's lint over its node_modules + generated
      // files produces thousands of irrelevant findings.
      "docs-site/**",
      // Same for cli-client + github-action + mcp-server — separate
      // sub-projects with their own toolchains.
      "cli-client/**",
      "github-action/**",
      "mcp-server/**",
      // LSP server (Python) and editor extensions (own tsconfig +
      // compile target) ship independently of the main Next.js app.
      "lsp-server/**",
      "editor-extensions/**",
    ],
  },
  {
    // Design system enforcement: flag raw stone-* outside the
    // primitives + tokens themselves.
    files: ["src/app/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}"],
    ignores: [
      // Primitives ARE the design system; they consume tokens via
      // class names like `bg-canvas` / `text-strong` (which compile
      // from stone shades in globals.css). They never reference raw
      // stones directly, but if a future primitive needs a one-off
      // it stays inside the design-system boundary.
      "src/components/ui/**",
      // Email templates use the design-tokens.ts JS export, not
      // Tailwind classes — they have their own boundary.
      "src/emails/**",
    ],
    rules: {
      // Inherits the typescript-eslint plugin's no-restricted-syntax
      // rule (which has the same schema as the core rule, plus
      // TS-specific selectors). The `Literal[value=/regex/]` esquery
      // matches className strings containing raw stone shades.
      "no-restricted-syntax": [
        "warn",
        {
          selector: RAW_STONE_PATTERN,
          message: RAW_STONE_MESSAGE,
        },
      ],
    },
  },
];

export default eslintConfig;
