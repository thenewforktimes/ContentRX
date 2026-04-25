"use client";

/**
 * Recharts-using chart components, split out so analytics-client.tsx
 * can dynamic-import them. Closes audit H-16.
 *
 * Recharts pulls in d3 modules (~374kB raw / ~115kB minified) and was
 * statically imported into the analytics-client bundle, blowing the
 * /dashboard/team/analytics page to ~115kB. Splitting these into a
 * separate file lets next/dynamic create a separate chunk that only
 * loads when this page mounts (and not on the initial dashboard
 * navigation that doesn't show charts).
 */

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type TopStandardItem = { standard_id: string; count: number };
export type DailyItem = { day: string; count: number };

export function TopStandardsChart({ items }: { items: TopStandardItem[] }) {
  return (
    <div className="h-64 w-full">
      <ResponsiveContainer>
        <BarChart
          data={items}
          layout="vertical"
          margin={{ top: 4, right: 12, bottom: 4, left: 32 }}
        >
          <CartesianGrid
            stroke="currentColor"
            strokeOpacity={0.1}
            horizontal={false}
          />
          <XAxis
            type="number"
            tick={{ fontSize: 11 }}
            stroke="currentColor"
            strokeOpacity={0.4}
          />
          <YAxis
            type="category"
            dataKey="standard_id"
            tick={{ fontSize: 11 }}
            stroke="currentColor"
            strokeOpacity={0.4}
            width={72}
          />
          <Tooltip
            cursor={{ fillOpacity: 0.05 }}
            contentStyle={{
              fontSize: 12,
              borderRadius: 6,
              border: "1px solid #e5e5e5",
            }}
          />
          <Bar dataKey="count" fill="currentColor" radius={[0, 4, 4, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DailyChart({ items }: { items: DailyItem[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer>
        <LineChart data={items} margin={{ top: 4, right: 12, bottom: 4, left: 0 }}>
          <CartesianGrid stroke="currentColor" strokeOpacity={0.1} />
          <XAxis
            dataKey="day"
            tick={{ fontSize: 10 }}
            stroke="currentColor"
            strokeOpacity={0.4}
            tickFormatter={(d) => d.slice(5)}
          />
          <YAxis
            tick={{ fontSize: 11 }}
            stroke="currentColor"
            strokeOpacity={0.4}
            allowDecimals={false}
          />
          <Tooltip
            contentStyle={{
              fontSize: 12,
              borderRadius: 6,
              border: "1px solid #e5e5e5",
            }}
          />
          <Line
            type="monotone"
            dataKey="count"
            stroke="currentColor"
            strokeWidth={2}
            dot={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
