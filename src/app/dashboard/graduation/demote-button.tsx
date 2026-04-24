"use client";

/**
 * Client island for manual demotion. Separate from the approve button
 * so the two paths can evolve independently — approval is additive
 * ("yes, graduate"), demotion is subtractive ("pull this back").
 */

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { GraduationLevel } from "@/lib/graduation";

export function DemoteButton({
  standardId,
  currentLevel,
  targetLevel,
}: {
  standardId: string;
  currentLevel: GraduationLevel;
  targetLevel: GraduationLevel;
}) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function handleClick() {
    if (state !== "idle") return;

    const reason = window.prompt(
      `Demoting ${standardId} from ${currentLevel} → ${targetLevel}. Reason for the audit log:`,
    );
    if (!reason) return;

    setState("loading");
    try {
      const res = await fetch("/api/graduation/demote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          standard_id: standardId,
          target_level: targetLevel,
          reason,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? `HTTP ${res.status}`);
      }
      setState("done");
      setMessage(`Demoted ${standardId} → ${targetLevel}.`);
      router.refresh();
    } catch (err) {
      setState("error");
      setMessage(err instanceof Error ? err.message : "Demotion failed.");
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={state !== "idle"}
        className="rounded-md border border-neutral-300 bg-white px-2.5 py-1 text-[10px] font-medium text-neutral-700 hover:bg-neutral-50 disabled:opacity-50 dark:border-neutral-700 dark:bg-neutral-950 dark:text-neutral-300 dark:hover:bg-neutral-900"
      >
        {state === "loading"
          ? "Demoting…"
          : state === "done"
          ? "Demoted ✓"
          : state === "error"
          ? "Retry"
          : `Demote → ${targetLevel}`}
      </button>
      {message && (
        <p
          className={`text-[10px] ${
            state === "error"
              ? "text-red-700 dark:text-red-400"
              : "text-neutral-500"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
