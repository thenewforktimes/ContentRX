"use client";

/**
 * Top-level error boundary. Captures any error that escapes a route
 * segment's own error.tsx so Sentry sees crashes the user-facing UI
 * couldn't handle.
 */

import * as Sentry from "@sentry/nextjs";
import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({
  error,
}: {
  error: Error & { digest?: string };
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body className="bg-canvas text-strong">
        <main className="flex min-h-screen items-center justify-center p-6">
          <div className="max-w-md text-center">
            <h1 className="mb-2 text-xl font-semibold">
              We couldn&apos;t load this page.
            </h1>
            <p className="text-sm text-default">
              A temporary issue on our end interrupted the request.
              Refresh to try again, or head back to{" "}
              <Link href="/" className="underline text-accent-primary-text">
                the homepage
              </Link>
              . If it keeps happening, email{" "}
              <a
                href="mailto:hello@contentrx.io"
                className="underline text-accent-primary-text"
              >
                hello@contentrx.io
              </a>
              .
            </p>
          </div>
        </main>
      </body>
    </html>
  );
}
