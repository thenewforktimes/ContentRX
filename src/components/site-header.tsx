/**
 * Site header — global chrome for marketing + transactional pages.
 *
 * Renders the ContentRX logo (always links home) plus the primary
 * cross-page nav (Pricing, Install, Sign in, Try free). Lives
 * in the (marketing) route group's layout; doesn't render on the
 * dashboard (which has its own header in (authed)/dashboard/layout)
 * or on /admin (founder voice keeps its own dense layout).
 *
 * Mobile: nav collapses to a thinner row that wraps. No hamburger
 * menu yet — the link set is small enough that wrapping is fine.
 * Revisit if the nav grows past 5 items.
 *
 * The "Try free" CTA uses the primary button style (emerald per the
 * Calm Sage palette). "Sign in" is a ghost link to keep the right
 * side from feeling button-heavy.
 */

import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { Wordmark } from "@/components/wordmark";

export function SiteHeader() {
  return (
    <header className="border-b border-line bg-raised">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <Wordmark size="xs" />
        {/*
         * `aria-label="Primary"` (WCAG 2.4.6) distinguishes this nav
         * from the footer nav for screen-reader users navigating by
         * landmark.
         *
         * Link focus ring (WCAG 2.4.7): bare links on bg-raised were
         * relying on the browser default focus outline, which is
         * unreliable on tinted backgrounds. Now every link wears the
         * design-system focus ring explicitly.
         */}
        <nav
          aria-label="Primary"
          className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm"
        >
          <Link
            href="/pricing"
            className="rounded text-quiet hover:text-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-raised"
          >
            Pricing
          </Link>
          <Link
            href="/install"
            className="rounded text-quiet hover:text-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-raised"
          >
            Install
          </Link>
          <Link
            href="/sign-in"
            className="rounded text-quiet hover:text-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-raised"
          >
            Sign in
          </Link>
          <Link
            href="/sign-up"
            className={buttonStyles({ variant: "primary", size: "sm" })}
          >
            Try free
          </Link>
        </nav>
      </div>
    </header>
  );
}
