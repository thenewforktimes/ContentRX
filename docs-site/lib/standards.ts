/**
 * Standards loader for the docs site.
 *
 * Reads the engine's `standards_library.json` from a build-time copy
 * inside docs-site/lib/. The copy is refreshed by the `prebuild` /
 * `predev` npm scripts which cp the canonical file from
 * `../src/content_checker/standards/standards_library.json`.
 *
 * Vercel's build layout places the docs-site working dir at
 * /vercel/docs-site/ (not /vercel/path0/docs-site/), so the original
 * `../src/...` relative path doesn't resolve at build time. Copying
 * into docs-site makes the build self-contained regardless of where
 * Vercel chroots.
 */

import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type Standard = {
  id: string;
  rule: string;
  correct?: string;
  incorrect?: string;
  rule_type?: "hard" | "nuanced" | string;
  checkable_from?: string;
  relevant_content_types?: string[];
  content_type_notes?: Record<string, string>;
};

export type Category = {
  id: string;
  name: string;
  standards: Standard[];
};

export type ContentType = {
  id: string;
  name: string;
  description: string;
};

export type StandardsLibrary = {
  version: string;
  total_standards: number;
  content_types: ContentType[];
  categories: Category[];
};

let cached: StandardsLibrary | null = null;

export function loadLibrary(): StandardsLibrary {
  if (cached) return cached;
  // Resolve relative to THIS file, not process.cwd(), so the lookup
  // works under `next dev`, `next build`, AND Vercel's build chroot.
  // The prebuild/predev scripts in package.json keep this copy fresh.
  const here =
    typeof __dirname !== "undefined"
      ? __dirname
      : dirname(fileURLToPath(import.meta.url));
  const path = join(here, "standards_library.json");
  const raw = readFileSync(path, "utf-8");
  cached = JSON.parse(raw) as StandardsLibrary;
  return cached;
}

export function getStandard(id: string): Standard | null {
  const lib = loadLibrary();
  for (const cat of lib.categories) {
    const std = cat.standards.find((s) => s.id === id);
    if (std) return std;
  }
  return null;
}

export function categoryOfStandard(id: string): Category | null {
  const lib = loadLibrary();
  return (
    lib.categories.find((c) => c.standards.some((s) => s.id === id)) ?? null
  );
}

export function allStandardIds(): string[] {
  return loadLibrary().categories.flatMap((c) => c.standards.map((s) => s.id));
}
