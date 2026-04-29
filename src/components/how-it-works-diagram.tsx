"use client";

/**
 * HowItWorksDiagram — animated five-stage pipeline that visualises
 * "the model around the model."
 *
 * The diagram pulses through the five stages every 1.5s, glowing the
 * active stage. The point: ContentRX isn't an LLM with a prompt; it's
 * a content-design pipeline with the LLM in the middle. The diagram
 * compresses that into a glance.
 *
 * Accessibility:
 *   - The whole thing is an ordered list, so screen readers walk
 *     the stages in order.
 *   - The animation respects `prefers-reduced-motion`. With reduce,
 *     no stage cycles; readers see the static layout.
 *
 * Substrate boundary (ADR 2026-04-25): the stages are described in
 * customer-readable terms. We don't expose `standard_id`, taxonomy
 * names, or the specific number of standards. The diagram is the
 * shape of the pipeline, not its internals.
 */

import { useEffect, useState } from "react";

interface Stage {
  /** Short stage label, shown as the headline. */
  label: string;
  /** One-line description below the label. */
  caption: string;
  /** Tiny inline example (rendered in mono) on the leftmost stage. */
  example?: string;
}

const STAGES: ReadonlyArray<Stage> = [
  {
    label: "Your string",
    caption: "Anything a customer reads",
    example: '"Click here"',
  },
  {
    label: "Classify",
    caption: "Error? Empty state? Destructive confirmation?",
  },
  {
    label: "Filter",
    caption: "Only the standards that apply to this moment",
  },
  {
    label: "Review",
    caption: "Staff-level pattern recognition, encoded",
  },
  {
    label: "Verdict",
    caption: "Issue, suggestion, severity, confidence",
  },
];

const STAGE_INTERVAL_MS = 1500;

export function HowItWorksDiagram() {
  const [activeStage, setActiveStage] = useState(0);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduceMotion(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (reduceMotion) return;
    const interval = setInterval(() => {
      setActiveStage((prev) => (prev + 1) % STAGES.length);
    }, STAGE_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [reduceMotion]);

  return (
    <div className="my-8" aria-label="ContentRX evaluation pipeline">
      <ol className="flex flex-col gap-3 sm:flex-row sm:items-stretch sm:gap-2">
        {STAGES.map((stage, i) => {
          const isActive = !reduceMotion && i === activeStage;
          return (
            <li
              key={stage.label}
              className="flex flex-1 items-stretch gap-2 sm:flex-col sm:items-stretch"
            >
              <div
                data-active={isActive ? "true" : "false"}
                className="flex flex-1 flex-col rounded-lg border border-stone-200 bg-white px-4 py-3 transition-all duration-500 ease-out data-[active=true]:-translate-y-0.5 data-[active=true]:border-emerald-500 data-[active=true]:bg-emerald-50 data-[active=true]:shadow-sm dark:border-stone-800 dark:bg-stone-950 data-[active=true]:dark:border-emerald-500 data-[active=true]:dark:bg-emerald-950/40"
              >
                <p className="text-[10px] font-mono uppercase tracking-widest text-stone-500 dark:text-stone-400">
                  Stage {i + 1}
                </p>
                <p className="mt-1 text-sm font-semibold text-stone-900 dark:text-stone-100">
                  {stage.label}
                </p>
                <p className="mt-1 text-xs text-stone-600 dark:text-stone-300">
                  {stage.caption}
                </p>
                {stage.example && (
                  <p className="mt-2 font-mono text-xs text-stone-500 dark:text-stone-400">
                    {stage.example}
                  </p>
                )}
              </div>
              {i < STAGES.length - 1 && (
                <Connector activeBefore={isActive} />
              )}
            </li>
          );
        })}
      </ol>
      <p className="mt-4 text-xs text-stone-500 dark:text-stone-400">
        Each stage compresses what reaches the LLM down to the
        standards that actually apply to your string in your moment.
        That&apos;s the model around the model.
      </p>
    </div>
  );
}

/**
 * Connector — chevron between stages. On desktop renders horizontally
 * (a right-pointing chevron); on mobile renders vertically (a
 * down-pointing chevron). Fades in/out subtly when the preceding stage
 * is active so the eye follows the flow.
 */
function Connector({ activeBefore }: { activeBefore: boolean }) {
  return (
    <div
      data-active={activeBefore ? "true" : "false"}
      className="flex shrink-0 items-center justify-center self-center text-stone-300 transition-colors duration-500 data-[active=true]:text-emerald-500 dark:text-stone-700 data-[active=true]:dark:text-emerald-400 sm:self-auto sm:py-1"
      aria-hidden
    >
      <svg
        viewBox="0 0 12 12"
        className="h-3 w-3 rotate-90 sm:rotate-0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M4 2 L8 6 L4 10" />
      </svg>
    </div>
  );
}
