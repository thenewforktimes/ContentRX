/**
 * Divider — semantic horizontal rule using the design-token border.
 *
 * Replaces the 50+ inline `border-t border-stone-200 dark:border-stone-800`
 * patterns. Renders as `<hr>` by default (correct semantics for a
 * thematic break between sections). When you want a non-semantic
 * visual divider inside a layout (e.g., separating items in a list
 * row), pass `decorative` to render a span with role="separator"
 * aria-hidden — visual only, screen readers skip it.
 */

export function Divider({
  decorative = false,
  className = "",
}: {
  decorative?: boolean;
  className?: string;
}) {
  const lineClasses = ["border-t border-line", className]
    .filter(Boolean)
    .join(" ");
  if (decorative) {
    return (
      <span role="separator" aria-hidden className={lineClasses} />
    );
  }
  return <hr className={lineClasses} />;
}
