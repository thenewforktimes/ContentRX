"use client";

/**
 * Client-island wrapper that dynamic-imports the chart so it's a
 * separate webpack chunk loaded only when /admin/calibration mounts.
 * The chart itself is now a hand-rolled SVG (Recharts was retired
 * pre-Pf7; see `./charts.tsx`) — the dynamic-import wrapper survives
 * because the code-split is still useful on a founder-only route.
 * (Earlier comment cross-referenced a `dashboard/team/analytics`
 * peer that no longer exists; removed.)
 */

import dynamic from "next/dynamic";
import type { SystemKappaTrendChartProps } from "./charts";

const SystemKappaTrendChart = dynamic(
  () => import("./charts").then((m) => m.SystemKappaTrendChart),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 w-full animate-pulse rounded-lg border border-line bg-overlay" />
    ),
  },
);

export function CalibrationCharts(props: SystemKappaTrendChartProps) {
  return <SystemKappaTrendChart {...props} />;
}
