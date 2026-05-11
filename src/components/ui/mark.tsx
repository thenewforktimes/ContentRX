/**
 * Mark — inline highlight for one or two keywords inside a paragraph.
 *
 * The `<Eyebrow highlight>` swatch from #478 is the section-label
 * version of the same idea; this is the in-body version. Use it on
 * long-form pages (`/ethics`, `/calibration`, `/accuracy`'s
 * methodology section) to let dense paragraphs breathe and signal
 * the load-bearing phrase to a reader scanning instead of reading
 * line-by-line.
 *
 *   <p>
 *     The substrate produces the <Mark>report</Mark> through
 *     scheduled generators.
 *   </p>
 *
 * Renders semantic `<mark>` — screen readers announce it as a
 * highlight, which is the right semantics for "this is the
 * keyword." Visual treatment uses the same AAA-verified tokens as
 * Eyebrow's highlight variant (`bg-accent-caution-soft` +
 * `text-accent-caution-text`), so the marker-pen vocabulary stays
 * consistent across surfaces.
 *
 * One tone for now (`caution`, the warm-amber band). If a second
 * tone becomes necessary, add it via a `tone` prop — don't add
 * variant divergence inline. The skill of the primitive is that two
 * paragraphs marking different keywords look like they're using the
 * same pen.
 */

import type { ReactNode } from "react";

export function Mark({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <mark
      className={`rounded-sm bg-accent-caution-soft px-1 text-accent-caution-text ${className}`.trim()}
    >
      {children}
    </mark>
  );
}
