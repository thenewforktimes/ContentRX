import Link from "next/link";
import { SignIn } from "@clerk/nextjs";

export default function Page() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 py-12">
      {/*
        Logo escape: visitors who land on /sign-in from a marketing
        link and change their mind otherwise have only browser-back
        as an exit. The centered logo above the form gives them a
        clickable way home without competing with the auth task.
      */}
      <Link
        href="/"
        className="mb-8 text-sm font-semibold tracking-tight text-strong"
        aria-label="ContentRX home"
      >
        ContentRX
      </Link>
      <SignIn />
    </main>
  );
}
