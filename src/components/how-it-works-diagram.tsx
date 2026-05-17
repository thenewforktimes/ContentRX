"use client";

/**
 * HowItWorksDiagram — "the funnel", v8 (2026-05-16).
 *
 * v8 refines v7 from a third live design-critique pass. The story and
 * the galaxy-to-selection mechanic are right (Robert: "those first
 * two frames are excellent"). Four execution fixes:
 *
 *   1. Vocabulary — the caption said "in your moment". "Moment" is an
 *      internal taxonomy axis (ADR 2026-04-25), never customer copy.
 *      Rewritten, and the lint:copy gate now has a
 *      `no-moment-taxonomy-vocab` rule (idiom-aware) so it cannot
 *      recur silently.
 *   2. Metadata row — the severity / instant / before-merge / category
 *      line mixed a pill, bare text, another pill, and an ml-auto
 *      gap, so the horizontal rhythm was off. v8 is one balanced
 *      justify-between row: the verdict pill plus one consistent meta
 *      group on the left, the category on the right.
 *   3. Proportions — a full-bleed ~4:1 letterbox read as stretched
 *      and skinny. v8 contains the whole block to max-w-3xl and makes
 *      the stage taller, so it reads as a designed panel (~2.4:1).
 *   4. The field — bordered chips around the words looked shabby. v8
 *      drops the boxes entirely: the field is luminous typography,
 *      depth carried by size + opacity + weight. On selection the
 *      three that apply do not get a box — they brighten to the
 *      affirm color and gain a soft glow; the rest fall away.
 *
 * Five claim-beats (the value, not the mechanics):
 *   1. Every rule that could apply
 *   2. Narrowed to the few that do        ← the IP, watched live
 *   3. Judged against an opinionated standard
 *   4. With the reason, before merge
 *   5. Accuracy you can check             ← links /accuracy (moat)
 *
 * Substrate boundary (ADR 2026-04-25): customer-readable terms only.
 * The field uses PUBLIC category names already shipped on /writes +
 * the hero mock. No standard_id, no rule version, no taxonomy IDs, no
 * taxonomy-axis vocabulary, no standards prose, no exemplars. The
 * resolved finding reuses the hero verdict-mock's substrate-clean
 * error-message example verbatim, for page coherence.
 *
 * Accessibility:
 *   - The five beats are a semantic <ol>; the <figure> carries the
 *     whole story in aria-label. The animated layer is aria-hidden.
 *   - Meaningful content (finding, before-merge, the accuracy link,
 *     beat labels) uses AAA tokens. The decorative field is
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

// The three categories that apply to this check. A stable subset of
// the public category names — these light up out of the field.
const APPLIES = ["Clarity", "Voice and tone", "Plain language"] as const;

// The rule field. Public category names only — every one already
// ships on /writes or the hero mock. Distinct (no repeats). Each
// carries a deterministic position, a depth `z` (0..1 — higher reads
// nearer: larger, more opaque, heavier), and a stagger delay `d`. No
// Math.random, so SSR and client agree (no hydration mismatch).
// Survivor is derived from membership in APPLIES, never hand-flagged.
const FIELD: ReadonlyArray<{
  label: string;
  x: number;
  y: number;
  z: number;
  d: number;
}> = [
  { label: "Clarity", x: 17, y: 24, z: 0.92, d: 0.1 },
  { label: "Scope", x: 7, y: 12, z: 0.6, d: 0.02 },
  { label: "Specific reference", x: 84, y: 14, z: 0.46, d: 0.04 },
  { label: "Voice and tone", x: 72, y: 28, z: 0.88, d: 0.16 },
  { label: "Specificity", x: 9, y: 58, z: 0.5, d: 0.05 },
  { label: "Active voice", x: 86, y: 60, z: 0.42, d: 0.08 },
  { label: "Plain language", x: 46, y: 75, z: 0.9, d: 0.22 },
  { label: "Completeness", x: 26, y: 88, z: 0.56, d: 0.13 },
  { label: "Reader impact", x: 64, y: 86, z: 0.4, d: 0.07 },
  { label: "Reviewability", x: 88, y: 84, z: 0.38, d: 0.15 },
];

const isSurvivor = (label: string): boolean =>
  (APPLIES as readonly string[]).includes(label);

// Rhythm: linger on the field (beat 1) and the narrowing (beat 2 —
// the IP), let the judgment land, rest on the proof.
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
      className="my-8 max-w-3xl"
      aria-label="How ContentRX evaluates. Every rule that could apply is narrowed to the few that do, judged against an opinionated standard, returned with the reason before merge, with accuracy measured and published."
    >
      <div
        aria-hidden
        className="relative h-72 overflow-hidden rounded-2xl border border-line bg-raised shadow-lg shadow-canvas/40 ring-1 ring-line/30 sm:h-80"
      >
        <Stage phase={phase} reduce={reduce} />
      </div>

      {/* Semantic narrative: the five claim-beats. AAA, SR-walkable,
          and the full static story under reduced motion. */}
      <ol className="mt-5 grid grid-cols-1 gap-2 sm:grid-cols-5">
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
        Most rules never reach the model. Only the few that fit this
        check. That is the model around the model.
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
      {/* Phase 0-1: the field of rules, then the selection. No boxes —
          luminous type, depth via size + opacity + weight. The three
          that apply brighten and glow in place; the rest fall away.
          One positioning system (percent within the panel), no vw. */}
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
              const near = p.z >= 0.78;
              const baseOpacity = 0.34 + p.z * 0.46;
              const baseScale = 0.92 + p.z * 0.12;
              const fontSize = 12 + p.z * 11;
              const target = selecting
                ? survivor
                  ? { opacity: 1, scale: 1.18, y: 0 }
                  : { opacity: 0, scale: 0.5, y: 14 }
                : { opacity: baseOpacity, scale: baseScale, y: 0 };
              return (
                <motion.span
                  key={p.label}
                  className={[
                    "absolute -translate-x-1/2 -translate-y-1/2 select-none whitespace-nowrap tracking-tight transition-all duration-500",
                    selecting && survivor
                      ? "font-semibold text-accent-affirm-text [text-shadow:0_0_18px_currentColor]"
                      : near
                        ? "font-medium text-default"
                        : "font-normal text-quiet",
                  ].join(" ")}
                  style={{
                    left: `${p.x}%`,
                    top: `${p.y}%`,
                    fontSize: `${fontSize}px`,
                  }}
                  initial={{ opacity: 0, scale: 0.6, y: 0 }}
                  animate={target}
                  transition={{
                    duration: selecting ? (survivor ? 0.55 : 0.6) : 0.7,
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
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2.5">
                  <Pill tone="amber" size="xs">
                    Worth adjusting
                  </Pill>
                  <span className="text-[10px] font-medium uppercase tracking-wider text-quiet">
                    ⚡ Instant
                    {showBeforeMerge && (
                      <motion.span
                        initial={reduce ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{
                          duration: 0.35,
                          ease: [0.16, 1, 0.3, 1],
                        }}
                      >
                        <span
                          aria-hidden
                          className="mx-1.5 text-quiet/50"
                        >
                          ·
                        </span>
                        ✓ Before merge
                      </motion.span>
                    )}
                  </span>
                </div>
                <span className="shrink-0 text-[10px] font-medium uppercase tracking-wider text-quiet">
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
