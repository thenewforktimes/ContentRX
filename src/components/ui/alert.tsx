/**
 * Alert — bordered callout box, four semantic tones.
 *
 * Replaces the ~10 inline `border border-{tone}-300 bg-{tone}-50 ...
 * dark:border-{tone}-{800,900} dark:bg-{tone}-{950} dark:text-{tone}-{200,300}`
 * patterns scattered across the dashboard, marketing, and admin
 * surfaces. One primitive, one shape, one source of truth.
 *
 * Tone vocabulary mirrors the design tokens directly:
 *
 *   affirm   — success state, "you're set", positive completion
 *   caution  — warning, "worth a look", quota nearing limit
 *   concern  — error, payment failed, session expired
 *   info     — neutral notice, "here's something to know"
 *
 * Semantic role auto-applies based on tone:
 *   - caution + concern → role="alert" (assertive — interrupts SR)
 *   - affirm + info     → role="status" (polite — read at next pause)
 *
 * Override via `role` prop only if you have a specific reason; the
 * defaults follow WAI-ARIA practice for the meaning of each tone.
 */

import type { ReactNode } from "react";

export type AlertTone = "affirm" | "caution" | "concern" | "info";

const toneClasses: Record<AlertTone, string> = {
  affirm:
    "border-accent-affirm-border bg-accent-affirm-soft text-accent-affirm-text",
  caution:
    "border-accent-caution-border bg-accent-caution-soft text-accent-caution-text",
  concern:
    "border-accent-concern-border bg-accent-concern-soft text-accent-concern-text",
  info:
    "border-accent-info-border bg-accent-info-soft text-accent-info-text",
};

const defaultRole: Record<AlertTone, "alert" | "status"> = {
  affirm: "status",
  caution: "alert",
  concern: "alert",
  info: "status",
};

export function Alert({
  tone = "info",
  title,
  role,
  className = "",
  children,
}: {
  tone?: AlertTone;
  title?: string;
  role?: "alert" | "status";
  className?: string;
  children: ReactNode;
}) {
  const finalRole = role ?? defaultRole[tone];
  return (
    <div
      role={finalRole}
      className={[
        "flex flex-col gap-2 rounded-md border p-4 text-sm",
        toneClasses[tone],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {title && <h3 className="font-semibold">{title}</h3>}
      {children}
    </div>
  );
}
