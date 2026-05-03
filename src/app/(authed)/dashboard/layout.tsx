import Link from "next/link";
import { SignOutButton } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { SiteFooter } from "@/components/site-footer";
import { isContentRXAdmin } from "@/lib/graduation";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Founders see an "Admin" link in the chrome alongside Dashboard /
  // Settings — they routinely switch between the customer-facing
  // dashboard and the founder admin surface, and forcing them to
  // type the URL was a real friction point. The check is a cheap
  // string comparison against CONTENTRX_ADMIN_CLERK_IDS; non-founders
  // never see the link, never know /admin exists from this surface.
  const { userId } = await auth();
  const isFounder = userId ? isContentRXAdmin(userId) : false;

  return (
    <div className="flex min-h-screen flex-col bg-raised">
      <header className="border-b border-line">
        <div className="mx-auto flex max-w-3xl items-center justify-between gap-6 px-6 py-4">
          <Link href="/dashboard" className="text-sm font-semibold">
            ContentRX
          </Link>
          <nav className="flex items-center gap-5 text-xs">
            <Link
              href="/dashboard"
              className="text-quiet hover:text-strong"
            >
              Dashboard
            </Link>
            {isFounder && (
              <Link href="/admin" className="text-quiet hover:text-strong">
                Admin
              </Link>
            )}
            <Link
              href="/dashboard/settings"
              className="text-quiet hover:text-strong"
            >
              Settings
            </Link>
            <SignOutButton>
              <button
                type="button"
                className="text-quiet hover:text-strong"
              >
                Sign out
              </button>
            </SignOutButton>
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-10">
        {children}
      </main>
      <SiteFooter />
    </div>
  );
}
