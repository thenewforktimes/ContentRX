"use client";

/**
 * HowItWorksDiagram — "the funnel", v7 (2026-05-16).
 *
 * v7 refines v6 from a live design-critique pass. v6 had the right
 * story (the universe of editorial rules collapses to the few that
 * apply, resolves into one finding with its reason, before merge,
 * with accuracy you can check) but four execution defects:
 *
 *   1. Pacing — the universe-to-collapse signature beat was gone in
 *      ~2s, too fast to read. v7 re-paces slower with softer eases.
 *   2. Noise field — low-contrast (halved tokens) and repeated names
 *      (NOISE[i % 10] over 16 slots), so it read as filler mud, not
 *      a universe. v7 uses distinct tokens only, a real chip, and a
 *      per-token depth value (z) driving opacity + scale so it reads
 *      as a layered field.
 *   3. Frame consistency — noise exited by `12vw` (viewport units)
 *      while the rest was %/px, and the survivors vanished and were
 *      *replaced* by a differently-sized card. v7 uses one
 *      positioning system: the survivors are not replaced, they
 *      light up IN PLACE (accent-affirm, the same token as the beat
 *      numbers), the rest recede, then the lit focus hands off to
 *      the finding in the same panel.
 *   4. Container-in-container — a small card floated in a big
 *      same-coloured stage with a near-invisible border. v7 makes
 *      the stage the single elevated `bg-raised` panel; the finding
 *      composes inside it (no second frame).
 *
 * Five claim-beats (the value, not the mechanics):
 *   1. Every rule that could apply
 *   2. Narrowed to the few that do        ← the IP, watched live
 *   3. Judged against an opinionated standard
 *   4. With the reason, before merge
 *   5. Accuracy you can check             ← links /accuracy (moat)
 *
 * Substrate boundary (ADR 2026-04-25): customer-readable terms only.
 * The noise field uses PUBLIC category names already shipped on
 * /writes + the hero mock. No standard_id, no rule version, no
 * taxonomy IDs, no standards prose, no exemplars. The resolved
 * finding reuses the hero verdict-mock's substrate-clean error-string
 * example verbatim, for page coherence.
 *
 * Accessibility:
 *   - The five beats are a semantic <ol>; the <figure> carries the
 *     whole story in aria-label. The animated layer is aria-hidden.
 *   - Meaningful content (finding, before-merge, the accuracy link,
 *     beat labels) uses AAA tokens. The decorative noise field is
 *     aria-hidden.
 *   - prefers-reduced-motion: no loop; renders the fully-resolved
 *     end state with every beat shown.
 *
 * No accuracy claim without a link to /accuracy (CLAUDE.md
 * non-negotiable): beat 5 is a Link to /accuracy. The fixed-height
 * overflow-hidden panel is deliberate — v4/v5 flattened the
 * animation because variable content broke page layout; a stable
 * panel removes that failure mode.
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

// The three categories that "apply" to this check. A stable subset
// of the public category names — these light up out of the field.
const APPLIES = ["Clarity", "Voice and tone", "Plain language"] as const;

// The rule field. Public category names only — every one already
// ships on /writes or the hero mock. Distinct (no repeats). Each
// carries a deterministic position, a depth `z` (0..1 — higher reads
// nearer: more opaque + larger), and a stagger delay `d`. No
// Math.random, so SSR and client agree (no hydration mismatch).
// Survivor is derived from membership in APPLIES, never hand-flagged.
const FIELD: ReadonlyArray<{
  label: string;
  x: number;
  y: number;
  z: number;
  d: number;
}> = [
  { label: "Clarity", x: 16, y: 24, z: 0.9, d: 0.1 },
  { label: "Scope", x: 6, y: 11, z: 0.62, d: 0.02 },
  { label: "Specific reference", x: 87, y: 13, z: 0.48, d: 0.04 },
  { label: "Voice and tone", x: 73, y: 27, z: 0.86, d: 0.16 },
  { label: "Specificity", x: 8, y: 58, z: 0.5, d: 0.05 },
  { label: "Active voice", x: 85, y: 60, z: 0.44, d: 0.08 },
  { label: "Plain language", x: 47, y: 74, z: 0.9, d: 0.22 },
  { label: "Completeness", x: 27, y: 87, z: 0.58, d: 0.13 },
  { label: "Reader impact", x: 64, y: 85, z: 0.4, d: 0.07 },
  { label: "Reviewability", x: 87, y: 83, z: 0.38, d: 0.15 },
];

const isSurvivor = (label: string): boolean =>
  (APPLIES as readonly string[]).includes(label);

// Rhythm: linger on the universe (beat 1) and the narrowing (beat 2 —
// the IP), let the judgment land, rest on the proof. Slower than v6
// across the board per the critique.
const PHASE_MS = [2400, 2000, 1700, 1500, 2600] as const;
const RESET_MS = 600;
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
        className="relative h-56 overflow-hidden rounded-xl border border-line bg-raised shadow-lg shadow-canvas/40 ring-1 ring-line/30 sm:h-60"
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
  const showField = !reduce && phase <= 1;
  const selecting = !reduce && phase === 1;
  const showBeforeMerge = reduce || phase >= 3;
  const showReceipt = reduce || phase >= 4;

  return (
    <div className="absolute inset-0">
      {/* Phase 0-1: the universe of rules, then the selection. The
          three that apply light up in place; the rest recede. One
          positioning system (percent within the panel), no vw. */}
      <AnimatePresence>
        {showField && (
          <motion.div
            key="field"
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
          >
            {FIELD.map((p) => {
              const survivor = isSurvivor(p.label);
              const baseOpacity = 0.46 + p.z * 0.5;
              const baseScale = 0.82 + p.z * 0.16;
              const target = selecting
                ? survivor
                  ? { opacity: 1, scale: 1.06, x: 0, y: 0 }
                  : { opacity: 0, scale: 0.55, x: 0, y: 22 }
                : { opacity: baseOpacity, scale: baseScale, x: 0, y: 0 };
              return (
                <motion.span
                  key={p.label}
                  className={[
                    "absolute -translate-x-1/2 -translate-y-1/2 select-none whitespace-nowrap rounded-md border px-2.5 py-1 text-[11px] font-medium transition-colors duration-500",
                    selecting && survivor
                      ? "border-accent-affirm-border bg-accent-affirm-soft text-accent-affirm-text"
                      : "border-line bg-canvas/70 text-quiet",
                  ].join(" ")}
                  style={{ left: `${p.x}%`, top: `${p.y}%` }}
                  initial={{ opacity: 0, scale: 0.6 }}
                  animate={target}
                  transition={{
                    duration: selecting ? (survivor ? 0.6 : 0.7) : 0.7,
                    delay: selecting ? p.d : p.d * 0.9,
                    ease:
                      selecting && !survivor
                        ? [0.4, 0, 1, 1]
                        : [0.16, 1, 0.3, 1],
                  }}
                >
                  {p.label}
                </motion.span>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phase 2+: the lit focus hands off to one finding, with its
          reason. It composes INSIDE the panel — the panel is the
          frame, there is no second card. */}
      <AnimatePresence>
        {resolved && (
          <motion.div
            key="finding"
            className="absolute inset-0 flex items-center justify-center px-5 sm:px-8"
            initial={reduce ? false : { opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{
              duration: 0.6,
              delay: reduce ? 0 : 0.12,
              ease: [0.16, 1, 0.3, 1],
            }}
          >
            <div className="w-full max-w-xl">
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone="amber" size="xs">
                  Worth adjusting
                </Pill>
                <span className="text-[10px] font-medium uppercase tracking-wider text-quiet">
                  ⚡ Instant
                </span>
                {showBeforeMerge && (
                  <motion.span
                    initial={reduce ? false : { opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{
                      duration: 0.35,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                  >
                    <Pill tone="emerald" size="xs">
                      ✓ Before merge
                    </Pill>
                  </motion.span>
                )}
                <span className="ml-auto text-[10px] font-medium uppercase tracking-wider text-quiet">
                  Error message
                </span>
              </div>
              <p className="mt-3 font-mono text-[11px] leading-relaxed text-quiet">
                &ldquo;throw new Error(&quot;Something went wrong. Try
                again later.&quot;)&rdquo;
              </p>
              <p className="mt-3 text-sm font-medium text-strong">
                Says nothing. The user cannot tell what broke or what
                to do.
              </p>
              <div className="mt-3 rounded-md bg-sunken p-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-quiet">
                  Suggested
                </p>
                <p className="mt-1 text-sm text-default">
                  We couldn&rsquo;t save your changes. Check your
                  connection and retry.
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
