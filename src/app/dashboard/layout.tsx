import Link from "next/link";
import { SignOutButton } from "@clerk/nextjs";

// Force dynamic rendering for every page under /dashboard. Without
// this, Vercel's edge cache happily serves auth-gated HTML to other
// requests (observed in production: `age: 356`, `x-vercel-cache: HIT`
// on /dashboard with stale usage counts and stale "This week" data).
//
// Clerk's `auth()` is supposed to auto-opt-out of static rendering,
// but the middleware-level handshake rewrite confuses Next's static
// analysis under some conditions. Setting `dynamic = 'force-dynamic'`
// at the layout level cascades to every child page (overrides, runs,
// members, etc.) so we don't have to remember per-page.
export const dynamic = "force-dynamic";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white dark:bg-neutral-950">
      <header className="border-b border-neutral-200 dark:border-neutral-800">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-6 py-4">
          <Link href="/dashboard" className="text-sm font-semibold">
            ContentRX
          </Link>
          <SignOutButton>
            <button
              type="button"
              className="text-xs text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
            >
              Sign out
            </button>
          </SignOutButton>
        </div>
      </header>
      <main className="mx-auto max-w-3xl px-6 py-10">{children}</main>
    </div>
  );
}
