import Link from "next/link";
import { SignUp } from "@clerk/nextjs";

export default function Page() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      {/*
        Logo escape — same rationale as /sign-in. Visitors who change
        their mind get a clickable way home; the auth form stays the
        focus.
      */}
      <Link
        href="/"
        className="mb-8 text-sm font-semibold tracking-tight text-strong"
        aria-label="ContentRX home"
      >
        ContentRX
      </Link>
      {/*
        After successful sign-up, route through /onboard (the surface
        picker — PR-18) instead of straight to /dashboard. This is the
        "where do you want to use ContentRX?" decision the customer-
        journey diagrams call out as the first post-signup screen.
        Sign-in (returning users) still goes to /dashboard via the
        Clerk default — only fresh signups hit /onboard.
      */}
      <SignUp fallbackRedirectUrl="/onboard" />
    </main>
  );
}
