import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

/**
 * /install page copy-pin. Session 29's acceptance criterion is that
 * a first-time visitor sees MCP / CLI / GitHub Action as the primary
 * surfaces, with Figma alongside rather than leading. This test
 * locks the section order + the real install snippet for each.
 */

const SOURCE = fs.readFileSync(
  path.join(__dirname, "page.tsx"),
  "utf-8",
);

// Visible copy = source minus block/line comments so authorial
// framing notes don't trigger false positives.
const visible = SOURCE
  .replace(/\/\*[\s\S]*?\*\//g, "")
  .replace(/(^|\s)\/\/.*$/gm, "$1");

describe("/install page source", () => {
  it("renders MCP before CLI before GitHub Action before Figma", () => {
    const mcpIdx = visible.indexOf('id="mcp"');
    const cliIdx = visible.indexOf('id="cli"');
    const actionIdx = visible.indexOf('id="action"');
    const figmaIdx = visible.indexOf('id="figma"');
    expect(mcpIdx).toBeGreaterThan(-1);
    expect(cliIdx).toBeGreaterThan(mcpIdx);
    expect(actionIdx).toBeGreaterThan(cliIdx);
    expect(figmaIdx).toBeGreaterThan(actionIdx);
  });

  it("carries the real MCP install command", () => {
    expect(visible).toContain("uvx contentrx-mcp");
  });

  it("carries the real CLI install command", () => {
    expect(visible).toContain("pip install contentrx-cli");
  });

  it("carries the GitHub Action snippet with CONTENTRX_API_KEY", () => {
    expect(visible).toContain(".github/workflows/");
    expect(visible).toContain("CONTENTRX_API_KEY");
    expect(visible).toContain("fail-on: violation");
  });

  it("frames the Figma plugin as design-time, alongside the generation layer", () => {
    // Either phrase documents Session 29's reframe — the test is
    // deliberately permissive on phrasing, strict on intent.
    expect(visible).toMatch(/design-time/i);
    expect(visible).toMatch(/alongside/i);
  });

  it("cross-links the accountability surface", () => {
    for (const href of ["/model", "/accuracy", "/dashboard"]) {
      expect(visible).toContain(`href="${href}"`);
    }
  });
});
