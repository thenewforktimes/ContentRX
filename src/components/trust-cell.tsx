/**
 * TrustCell — quadrant cell housing the four trust-page links.
 *
 * 2026-05-11 quadrant six-cell rebuild. The prior implementation
 * was an inline horizontal link strip sitting between the agent +
 * one-approval row and the author byline. Robo's call: convert it
 * to a quadrant cell so the lower fold reads as one coherent
 * 2x3 grid (six cells, identical geometry) instead of three
 * sub-sections plus a strip.
 *
 * Eyebrow: RECEIPTS. Headline: "The pages we publish." The four
 * links render as a 2x2 grid inside the cell — fills the cell
 * better than a vertical stack, gives each link visual breathing
 * room.
 *
 * Renders as <li> so it sits inside the OutcomesGrid <ul> grid
 * alongside the other five cells.
 */

import Link from "next/link";
import { Eyebrow } from "@/components/ui/eyebrow";

const LINKS: readonly { label: string; href: string }[] = [
  { label: "Privacy", href: "/privacy" },
  { label: "Security", href: "/security" },
  { label: "Install", href: "/install" },
  { label: "Accuracy", href: "/accuracy" },
] as const;

export function TrustCell() {
  return (
    <li className="flex flex-col rounded-2xl border border-line bg-raised p-6 sm:p-8">
      <Eyebrow>Receipts</Eyebrow>
      <p className="mt-3 text-lg font-semibold text-strong sm:text-xl">
        The pages we publish.
      </p>
      <p className="mt-2 text-sm text-default">
        Privacy, security, install, and the accuracy log. Open in
        the browser, no auth.
      </p>

      <ul
        aria-label="Trust pages"
        className="mt-auto grid grid-cols-2 gap-3 pt-8 text-base"
      >
        {LINKS.map((l) => (
          <li key={l.label}>
            <Link
              href={l.href}
              className="inline-flex items-center gap-1 font-medium text-default underline underline-offset-2 hover:text-strong"
            >
              {l.label} →
            </Link>
          </li>
        ))}
      </ul>
    </li>
  );
}
