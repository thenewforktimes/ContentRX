"use client";

/**
 * HowItWorksDiagram — "the funnel", v6 (2026-05-16).
 *
 * Rebuilt from the v5 five-box conveyor. v5 described a generic flow
 * (choose / check / evaluate / report / decide) and offloaded the
 * actual differentiator to a caption. v6 animates the one thing
 * competitors cannot copy: the model around the model. The universe
 * of editorial rules collapses to the few that apply to THIS check
 * in THIS moment, resolves into one finding WITH its reason, gated
 * before merge, with measured accuracy you can check.
 *
 * Five claim-beats (the value, not the mechanics):
 *   1. Every rule that could apply
 *   2. Narrowed to the few that do        ← the IP, made visible
 *   3. Judged against an opinionated standard
 *   4. With the reason, before merge
 *   5. Accuracy you can check             ← links /accuracy (moat)
 *
 * Substrate boundary (ADR 2026-04-25): customer-readable terms only.
 * The noise field + survivors use PUBLIC category names already
 * shipped on /writes + the hero mock. No standard_id, no rule
 * version, no taxonomy IDs, no standards prose, no exemplars. The
 * resolved finding reuses the hero verdict-mock's substrate-clean
 * error-string example verbatim, for page coherence.
 *
 * Accessibility:
 *   - The five beats are a semantic <ol>; the <figure> carries the
 *     whole story in aria-label. The animated layer is aria-hidden.
 *   - Meaningful content (survivors, finding, before-merge, the
 *     accuracy link, beat labels) uses AAA tokens. The pre-collapse
 *     noise field is decorative low-opacity, aria-hidden.
 *   - prefers-reduced-motion: no loop; renders the fully-resolved
 *     end state with every beat shown.
 *
 * No accuracy claim without a link to /accuracy (CLAUDE.md
 * non-negotiable): beat 5 is a Link to /accuracy. The fixed-height
 * overflow-hidden stage box is deliberate — v4/v5 flattened the
 * animation because variable content broke page layout; a stable
 * stage removes that failure mode.
 */

import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Pill } from "@/components/ui/pill";

const BEATS = [
  "Every rule that could apply",
  "Narrowed to the few that do",
  "Judged against an opinionated standard",
  "With the reason, before merge",
  "Accuracy you can check",
] as const;

// Public category names only — every one already ships on /writes or
// the hero mock. Decorative noise; aria-hidden. NOT taxonomy IDs.
const NOISE = [
  "Clarity",
  "Voice and tone",
  "Plain language",
  "Specificity",
  "Active voice",
  "Completeness",
  "Reader impact",
  "Reviewability",
  "Scope",
  "Specific reference",
] as const;

// The three that "apply" once the field collapses. A stable subset
// (public categories), brought to full emphasis.
const APPLIES = ["Clarity", "Voice and tone", "Plain language"] as const;

// Reused verbatim from HeroVerdictMock (shipped, substrate-clean,
// lint:copy-clean). The hero foregrounds this exact error-string
// finding, so resolving to it here makes the page read as one product.
const FINDING = {
  severityLabel: "Worth adjusting",
  category: "Error string",
  input: 'throw new Error("Something went wrong. Try again later.");',
  issue: "Says nothing. The user cannot tell what broke or what to do.",
  suggestion:
    "We couldn't save your changes. Check your connection and retry.",
} as const;

// Deterministic noise positions (no Math.random at render — avoids a
// hydration mismatch). Percentages within the stage box; staggered
// exit delays make the collapse read as a sweep, not a blink.
const NOISE_POS: ReadonlyArray<{ x: number; y: number; d: number }> = [
  { x: 6, y: 18, d: 0.0 },
  { x: 19, y: 62, d: 0.05 },
  { x: 30, y: 30, d: 0.02 },
  { x: 12, y: 78, d: 0.08 },
  { x: 41, y: 14, d: 0.03 },
  { x: 25, y: 46, d: 0.06 },
  { x: 52, y: 70, d: 0.09 },
  { x: 36, y: 84, d: 0.04 },
  { x: 63, y: 22, d: 0.07 },
  { x: 48, y: 38, d: 0.01 },
  { x: 71, y: 58, d: 0.1 },
  { x: 58, y: 82, d: 0.05 },
  { x: 80, y: 16, d: 0.03 },
  { x: 67, y: 44, d: 0.08 },
  { x: 86, y: 70, d: 0.02 },
  { x: 78, y: 34, d: 0.06 },
];

// Rhythm mirrors the product: compression is deterministic + snappy,
// the judgment takes a considered beat, the proof lands and rests.
const PHASE_MS = [1100, 900, 1400, 1100, 1900] as const;
const RESET_MS = 500;
const RESET = PHASE_MS.length;

export function HowItWorksDiagram() {
  const [tick, setTick] = useState(0);
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduce(mq.matches);
    sync();
    mq.addEventListener("change", sync);
    return () => mq.removeEventListener("change", sync);
  }, []);

  useEffect(() => {
    if (reduce) return;
    let id: ReturnType<typeof setTimeout> | undefined;
    let cancelled = false;
    const run = (t: number) => {
      if (cancelled) return;
      setTick(t);
      const ms = t === RESET ? RESET_MS : PHASE_MS[t];
      id = setTimeout(() => run((t + 1) % (RESET + 1)), ms);
    };
    run(0);
    return () => {
      cancelled = true;
      if (id) clearTimeout(id);
    };
  }, [reduce]);

  // phase 0..4 = beat index; -1 during the brief reset hold.
  const phase = reduce ? 4 : tick === RESET ? -1 : tick;

  return (
    <figure
      className="my-8"
      aria-label="How ContentRX evaluates. Every rule that could apply is narrowed to the few that do, judged against an opinionated standard, returned with the reason before merge, with accuracy measured and published."
    >
      <div
        aria-hidden
        className="relative h-56 overflow-hidden rounded-xl border border-line bg-canvas sm:h-60"
      >
        <Stage phase={phase} reduce={reduce} />
      </div>

      {/* Semantic narrative: the five claim-beats. AAA, SR-walkable,
          and the full static story under reduced motion. */}
      <ol className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-5">
        {BEATS.map((b, i) => {
          const active = !reduce && i === phase;
          const done = reduce || (phase > -1 && i < phase);
          return (
            <li
              key={b}
              data-active={active}
              className={[
                "flex items-baseline gap-2 text-xs leading-snug transition-colors duration-300 sm:flex-col sm:items-start sm:gap-1.5",
                active
                  ? "text-strong"
                  : done
                    ? "text-default"
                    : "text-quiet",
              ].join(" ")}
            >
              <span
                className={[
                  "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-[10px] font-semibold transition-colors duration-300",
                  active || done
                    ? "border-accent-affirm-border bg-accent-affirm-soft text-accent-affirm-text"
                    : "border-line text-quiet",
                ].join(" ")}
              >
                {i + 1}
              </span>
              {i === 4 ? (
                <Link
                  href="/accuracy"
                  className="rounded font-medium underline underline-offset-2 hover:text-strong focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-canvas"
                >
                  {b}
                </Link>
              ) : (
                <span className="font-medium">{b}</span>
              )}
            </li>
          );
        })}
      </ol>

      <figcaption className="mt-4 text-xs text-quiet">
        Most rules never reach the model. Only the few that fit your
        check, in your moment. That is the model around the model.
      </figcaption>
    </figure>
  );
}

function Stage({ phase, reduce }: { phase: number; reduce: boolean }) {
  // Reduced motion / reset: show the resolved composition statically.
  const resolved = reduce || phase >= 2;
  const showNoise = !reduce && phase <= 1;
  const collapsing = !reduce && phase === 1;
  const showBeforeMerge = reduce || phase >= 3;
  const showReceipt = reduce || phase >= 4;

  return (
    <div className="absolute inset-0">
      {/* Phase 0-1: the universe of rules, then the collapse. */}
      <AnimatePresence>
        {showNoise && (
          <motion.div
            key="noise"
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
          >
            {NOISE_POS.map((p, i) => {
              const word = NOISE[i % NOISE.length];
              return (
                <motion.span
                  key={i}
                  className="absolute select-none rounded-md border border-line/50 px-2 py-0.5 text-[10px] font-medium text-quiet/70"
                  style={{ left: `${p.x}%`, top: `${p.y}%` }}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={
                    collapsing
                      ? {
                          opacity: 0,
                          scale: 0.4,
                          x: "12vw",
                          y: 12,
                        }
                      : { opacity: 0.7, scale: 1, x: 0, y: 0 }
                  }
                  transition={{
                    duration: collapsing ? 0.55 : 0.4,
                    delay: collapsing ? p.d : p.d * 0.5,
                    ease: collapsing ? [0.4, 0, 1, 1] : "easeOut",
                  }}
                >
                  {word}
                </motion.span>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phase 1: the few that survive, converging to a tight column. */}
      <AnimatePresence>
        {collapsing && (
          <motion.div
            key="applies"
            className="absolute inset-0 flex flex-col items-center justify-center gap-1.5"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.2 } }}
          >
            {APPLIES.map((c, i) => (
              <motion.div
                key={c}
                initial={{ opacity: 0, scale: 0.8, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{
                  duration: 0.4,
                  delay: 0.35 + i * 0.08,
                  ease: [0.16, 1, 0.3, 1],
                }}
              >
                <Pill tone="neutral" size="xs">
                  {c}
                </Pill>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phase 2+: the few resolve into one finding, with its reason. */}
      <AnimatePresence>
        {resolved && (
          <motion.div
            key="finding"
            className="absolute inset-0 flex items-center justify-center px-4"
            initial={
              reduce ? false : { opacity: 0, scale: 0.94, y: 10 }
            }
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{
              duration: 0.5,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            <div className="w-full max-w-md rounded-xl border border-line bg-raised p-4 shadow-lg shadow-canvas/40 ring-1 ring-line/40 sm:p-5">
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone="amber" size="xs">
                  {FINDING.severityLabel}
                </Pill>
                <span className="text-[10px] font-medium uppercase tracking-wider text-quiet">
                  ⚡ Instant
                </span>
                {showBeforeMerge && (
                  <motion.span
                    initial={reduce ? false : { opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                  >
                    <Pill tone="emerald" size="xs">
                      ✓ Before merge
                    </Pill>
                  </motion.span>
                )}
                <span className="ml-auto text-[10px] font-medium uppercase tracking-wider text-quiet">
                  {FINDING.category}
                </span>
              </div>
              <p className="mt-3 font-mono text-[11px] leading-relaxed text-quiet">
                &ldquo;{FINDING.input}&rdquo;
              </p>
              <p className="mt-3 text-sm font-medium text-strong">
                {FINDING.issue}
              </p>
              <div className="mt-3 rounded-md bg-sunken p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-quiet">
                  Suggested
                </p>
                <p className="mt-1 text-sm text-default">
                  {FINDING.suggestion}
                </p>
              </div>
              {showReceipt && (
                <motion.p
                  initial={reduce ? false : { opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: reduce ? 0 : 0.1 }}
                  className="mt-3 text-[11px] text-quiet"
                >
                  Accuracy measured and published. Check our work.
                </motion.p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
