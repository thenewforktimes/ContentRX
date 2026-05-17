"use client";

/**
 * HowItWorksDiagram — "the constellation funnel", v9 (2026-05-16).
 *
 * v9 reworks only the front of the funnel (phase 0-1) from a fourth
 * live critique. Frames 3/4/5 (the finding, before-merge, receipt)
 * are confirmed good and are carried over byte-for-byte from v8.
 *
 * The note: v8's bare luminous words read as "just words with our
 * branded green" — no form, and the collapse was a fade, not a
 * motion that *guides*. Robert shared geometric inspiration (a
 * curved convergence, an astroid pinch, an intersection rosette).
 *
 * v9 synthesizes them into one thing: every rule is a node — a dot
 * plus its word — tethered by a faint bezier thread that all bow
 * into a single focal point on the right (the convergence of the
 * left reference). At the narrowing, the three that apply have their
 * threads ignite in the affirm color and their nodes *travel the
 * curves* inward with a concave, astroid-like ease (the middle
 * reference); the other seven recede and their threads fade. The
 * focal point is exactly where the finding then composes, so phase 2
 * is a real arrival, not a crossfade. The geometry (point + curve)
 * is the form — no boxes.
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

// The rule field, fanned on the left. Public category names only —
// every one already ships on /writes or the hero mock. Distinct (no
// repeats). Each carries a deterministic position (percent within
// the panel), a depth `z` (0..1 — higher reads nearer: larger dot +
// text, more visible thread), and a stagger delay `d`. No
// Math.random, so SSR and client agree (no hydration mismatch).
// Survivor is derived from membership in APPLIES, never hand-flagged.
const FIELD: ReadonlyArray<{
  label: string;
  x: number;
  y: number;
  z: number;
  d: number;
}> = [
  { label: "Scope", x: 9, y: 11, z: 0.5, d: 0.02 },
  { label: "Specific reference", x: 17, y: 20, z: 0.46, d: 0.05 },
  { label: "Clarity", x: 12, y: 31, z: 0.92, d: 0.1 },
  { label: "Specificity", x: 7, y: 41, z: 0.44, d: 0.07 },
  { label: "Voice and tone", x: 10, y: 52, z: 0.88, d: 0.16 },
  { label: "Active voice", x: 17, y: 61, z: 0.42, d: 0.09 },
  { label: "Plain language", x: 13, y: 70, z: 0.9, d: 0.22 },
  { label: "Completeness", x: 8, y: 80, z: 0.52, d: 0.13 },
  { label: "Reviewability", x: 16, y: 88, z: 0.38, d: 0.15 },
  { label: "Reader impact", x: 6, y: 24, z: 0.4, d: 0.04 },
];

// The convergence point — right of center, where the finding then
// composes (so the handoff is an arrival, not a crossfade).
const FOCAL = { x: 58, y: 50 } as const;

const isSurvivor = (label: string): boolean =>
  (APPLIES as readonly string[]).includes(label);

// Cubic-bezier control points for a node's thread: leave the node
// moving horizontally (holds its y → the fan splays), arrive at the
// focal point mostly converged. Shared by the SVG path and the
// survivor travel sampling so the word rides its own thread exactly.
function ctrl(n: { x: number; y: number }) {
  return {
    c1x: n.x + (FOCAL.x - n.x) * 0.55,
    c1y: n.y,
    c2x: FOCAL.x - (FOCAL.x - n.x) * 0.12,
    c2y: FOCAL.y + (n.y - FOCAL.y) * 0.3,
  };
}

function threadD(n: { x: number; y: number }): string {
  const { c1x, c1y, c2x, c2y } = ctrl(n);
  return `M ${n.x} ${n.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${FOCAL.x} ${FOCAL.y}`;
}

const bez = (p0: number, p1: number, p2: number, p3: number, t: number) => {
  const u = 1 - t;
  return (
    u * u * u * p0 +
    3 * u * u * t * p1 +
    3 * u * t * t * p2 +
    t * t * t * p3
  );
};

// Sample the node's own thread at a few t's → keyframes the survivor
// word travels along (it rides the curve, concave-eased).
const TRAVEL_T = [0, 0.42, 0.76, 1] as const;
function travel(n: { x: number; y: number }) {
  const { c1x, c1y, c2x, c2y } = ctrl(n);
  return {
    left: TRAVEL_T.map((t) => `${bez(n.x, c1x, c2x, FOCAL.x, t)}%`),
    top: TRAVEL_T.map((t) => `${bez(n.y, c1y, c2y, FOCAL.y, t)}%`),
  };
}

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
      {/* Phase 0-1: the constellation funnel. Faint bezier threads
          fan from the left-set rule nodes into one focal point. On
          the narrowing, the three that apply ignite (affirm) and
          travel their own curves inward; the rest recede. Geometry
          is the form — no boxes. One percent space; SVG matches the
          HTML overlay (preserveAspectRatio none + non-scaling
          stroke), so threads and nodes stay aligned at every size. */}
      <AnimatePresence>
        {showField && (
          <motion.div
            key="field"
            className="absolute inset-0"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
          >
            <svg
              className="absolute inset-0 h-full w-full"
              viewBox="0 0 100 100"
              preserveAspectRatio="none"
              fill="none"
            >
              {FIELD.map((n) => {
                const survivor = isSurvivor(n.label);
                const baseThread = 0.05 + n.z * 0.1;
                return (
                  <motion.path
                    key={n.label}
                    d={threadD(n)}
                    stroke="currentColor"
                    strokeWidth={1}
                    strokeLinecap="round"
                    vectorEffect="non-scaling-stroke"
                    className={[
                      "transition-colors duration-500",
                      selecting && survivor
                        ? "text-accent-affirm-text"
                        : "text-quiet",
                    ].join(" ")}
                    initial={{ opacity: 0 }}
                    animate={{
                      opacity: selecting
                        ? survivor
                          ? 0.5
                          : 0
                        : baseThread,
                    }}
                    transition={{
                      duration: selecting ? (survivor ? 0.6 : 0.5) : 0.7,
                      delay: selecting ? n.d : n.d * 0.9,
                      ease: [0.16, 1, 0.3, 1],
                    }}
                  />
                );
              })}
            </svg>

            {FIELD.map((n) => {
              const survivor = isSurvivor(n.label);
              const near = n.z >= 0.7;
              const baseOpacity = 0.4 + n.z * 0.45;
              const dot = 4 + n.z * 4;
              const fontSize = 12 + n.z * 6;
              const moving = selecting && survivor;
              const animate = moving
                ? {
                    left: travel(n).left,
                    top: travel(n).top,
                    opacity: [baseOpacity, 1, 1, 1],
                    scale: [1, 1.06, 1.12, 1.12],
                  }
                : selecting
                  ? { left: `${n.x}%`, top: `${n.y}%`, opacity: 0, scale: 0.5 }
                  : {
                      left: `${n.x}%`,
                      top: `${n.y}%`,
                      opacity: baseOpacity,
                      scale: 1,
                    };
              return (
                <motion.span
                  key={n.label}
                  className={[
                    "absolute flex -translate-y-1/2 select-none items-center gap-2 whitespace-nowrap tracking-tight transition-colors duration-500",
                    moving
                      ? "font-semibold text-accent-affirm-text [text-shadow:0_0_16px_currentColor]"
                      : near
                        ? "font-medium text-default"
                        : "font-normal text-quiet",
                  ].join(" ")}
                  style={{ fontSize: `${fontSize}px` }}
                  initial={{
                    left: `${n.x}%`,
                    top: `${n.y}%`,
                    opacity: 0,
                    scale: 0.6,
                  }}
                  animate={animate}
                  transition={{
                    duration: moving ? 1.15 : selecting ? 0.55 : 0.7,
                    delay: selecting ? n.d : n.d * 0.9,
                    times: moving ? [0, 0.42, 0.76, 1] : undefined,
                    ease: moving
                      ? [0.65, 0, 0.35, 1]
                      : selecting
                        ? [0.4, 0, 1, 1]
                        : [0.16, 1, 0.3, 1],
                  }}
                >
                  <span
                    className="shrink-0 rounded-full bg-current"
                    style={{ width: `${dot}px`, height: `${dot}px` }}
                  />
                  {n.label}
                </motion.span>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phase 2+: the lit focus hands off to one finding, with its
          reason. It composes INSIDE the panel — the panel is the
          frame, there is no second card. (Carried from v8 verbatim:
          frames 3/4/5 are confirmed good.) */}
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
