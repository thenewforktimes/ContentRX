"use client";

/**
 * ⌘K command palette for /admin.
 *
 * Cross-source search across overrides + queue + customer flags via
 * GET /api/admin/search?q=. Loop step 3 from the redesign — finding
 * a past review case across surfaces without filter-tab-spelunking.
 *
 * Bindings:
 *   - ⌘K / Ctrl+K toggles the palette (anywhere on /admin/*)
 *   - / focuses the input when the palette is already open
 *   - ESC closes
 *   - ↑ / ↓ moves selection; Enter follows the current row
 *
 * Accepts plain substrings, standard IDs ("ACT-01"), and hash prefixes
 * ("#a3f2…"). The backend handles routing per query shape.
 */

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";

type ResultType = "override" | "queue" | "flag";

interface SearchResult {
  type: ResultType;
  id: string;
  textPreview: string;
  contextLine: string;
  createdAt: string;
  href: string;
}

interface SearchResponse {
  query: string;
  results: SearchResult[];
  countsBySource: Record<ResultType, number>;
  truncated: boolean;
}

const TYPE_LABEL: Record<ResultType, string> = {
  override: "Override",
  queue: "Queue",
  flag: "Flag",
};

const TYPE_TONE: Record<ResultType, string> = {
  override: "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300",
  queue: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
  flag: "bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300",
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const inputId = useId();
  const router = useRouter();

  // Toggle on Cmd/Ctrl+K from anywhere.
  useEffect(() => {
    function onGlobalKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((v) => !v);
      }
    }
    window.addEventListener("keydown", onGlobalKey);
    return () => window.removeEventListener("keydown", onGlobalKey);
  }, []);

  // Autofocus when opened; reset state when closed.
  useEffect(() => {
    if (open) {
      setActiveIndex(0);
      setTimeout(() => inputRef.current?.focus(), 0);
    } else {
      setQuery("");
      setResults([]);
      setError(null);
    }
  }, [open]);

  // Debounced fetch on query change.
  useEffect(() => {
    if (!open) return;
    const trimmed = query.trim();
    if (trimmed.length === 0) {
      setResults([]);
      setError(null);
      return;
    }

    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(
          `/api/admin/search?q=${encodeURIComponent(trimmed)}`,
          { signal: ctrl.signal },
        );
        if (!res.ok) throw new Error(`Search failed (${res.status})`);
        const body = (await res.json()) as SearchResponse;
        setResults(body.results);
        setActiveIndex(0);
      } catch (err) {
        if ((err as { name?: string }).name === "AbortError") return;
        setError(
          err instanceof Error ? err.message : "Could not run the search.",
        );
      } finally {
        setLoading(false);
      }
    }, 180);

    return () => {
      clearTimeout(t);
      ctrl.abort();
    };
  }, [query, open]);

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (e.key === "Escape") {
        e.preventDefault();
        setOpen(false);
        return;
      }
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, Math.max(results.length - 1, 0)));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === "Enter") {
        const target = results[activeIndex];
        if (target) {
          e.preventDefault();
          setOpen(false);
          router.push(target.href);
        }
      }
    },
    [results, activeIndex, router],
  );

  const grouped = useMemo(() => {
    const out: Record<ResultType, SearchResult[]> = {
      override: [],
      queue: [],
      flag: [],
    };
    for (const r of results) out[r.type].push(r);
    return out;
  }, [results]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open search palette"
        className="flex w-full items-center justify-between gap-2 rounded-md border border-neutral-300 bg-white px-3 py-1.5 text-left text-xs text-neutral-500 hover:border-neutral-400 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:border-neutral-600"
      >
        <span>Find a case…</span>
        <kbd className="rounded border border-neutral-300 bg-neutral-100 px-1.5 py-0.5 font-mono text-[10px] text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-400">
          ⌘K
        </kbd>
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby={inputId}
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 p-4 pt-24"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <div
            ref={dialogRef}
            onKeyDown={onKeyDown}
            className="w-full max-w-2xl overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-2xl dark:border-neutral-800 dark:bg-neutral-900"
          >
            <div className="border-b border-neutral-200 dark:border-neutral-800">
              <input
                id={inputId}
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Find a case across overrides, queue, and customer flags…"
                className="w-full bg-transparent px-4 py-3 text-base text-neutral-900 placeholder:text-neutral-400 focus:outline-none dark:text-neutral-100 dark:placeholder:text-neutral-600"
              />
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {error && (
                <p className="px-4 py-3 text-sm text-red-700 dark:text-red-400">
                  {error}
                </p>
              )}
              {!error && query.trim().length === 0 && (
                <div className="px-4 py-6 text-sm text-neutral-500 dark:text-neutral-400">
                  <p>
                    Type to search across{" "}
                    <span className="font-medium">overrides</span>,{" "}
                    <span className="font-medium">queue items</span>, and{" "}
                    <span className="font-medium">customer flags</span>.
                  </p>
                  <ul className="mt-3 space-y-1 text-xs">
                    <li>
                      Plain text — substring match against text + notes
                    </li>
                    <li>
                      <span className="font-mono">ACT-01</span> — match a
                      standard ID
                    </li>
                    <li>
                      <span className="font-mono">#a3f2…</span> — match a
                      text-hash prefix
                    </li>
                  </ul>
                </div>
              )}
              {!error && query.trim().length > 0 && results.length === 0 && (
                <p className="px-4 py-6 text-sm text-neutral-500 dark:text-neutral-400">
                  {loading ? "Searching…" : "No matches."}
                </p>
              )}
              {!error && results.length > 0 && (
                <ul role="listbox">
                  {results.map((r, idx) => (
                    <ResultRow
                      key={`${r.type}-${r.id}`}
                      result={r}
                      active={idx === activeIndex}
                      onHover={() => setActiveIndex(idx)}
                      onSelect={() => setOpen(false)}
                    />
                  ))}
                </ul>
              )}
            </div>

            <footer className="flex items-center justify-between border-t border-neutral-200 px-4 py-2 text-[11px] text-neutral-500 dark:border-neutral-800 dark:text-neutral-400">
              <span>
                {results.length > 0 ? (
                  <>
                    {grouped.override.length} override
                    {grouped.override.length === 1 ? "" : "s"} ·{" "}
                    {grouped.queue.length} queue ·{" "}
                    {grouped.flag.length} flag
                    {grouped.flag.length === 1 ? "" : "s"}
                  </>
                ) : (
                  <span>↑↓ to move · Enter to open · Esc to close</span>
                )}
              </span>
              {loading && <span>Searching…</span>}
            </footer>
          </div>
        </div>
      )}
    </>
  );
}

function ResultRow({
  result,
  active,
  onHover,
  onSelect,
}: {
  result: SearchResult;
  active: boolean;
  onHover: () => void;
  onSelect: () => void;
}) {
  return (
    <li
      role="option"
      aria-selected={active}
      onMouseEnter={onHover}
      className={`border-b border-neutral-100 last:border-b-0 dark:border-neutral-800 ${
        active ? "bg-neutral-50 dark:bg-neutral-800" : ""
      }`}
    >
      <Link
        href={result.href}
        onClick={onSelect}
        className="block px-4 py-3"
      >
        <div className="flex items-start gap-3">
          <span
            className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide ${TYPE_TONE[result.type]}`}
          >
            {TYPE_LABEL[result.type]}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm text-neutral-900 dark:text-neutral-100">
              {result.textPreview}
            </p>
            <p className="mt-1 truncate text-xs text-neutral-500 dark:text-neutral-400">
              {result.contextLine}
            </p>
          </div>
          <span className="shrink-0 self-center text-[11px] text-neutral-400 dark:text-neutral-600">
            {formatRelative(new Date(result.createdAt))}
          </span>
        </div>
      </Link>
    </li>
  );
}

function formatRelative(date: Date): string {
  const elapsed = Date.now() - date.getTime();
  const minutes = Math.floor(elapsed / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
