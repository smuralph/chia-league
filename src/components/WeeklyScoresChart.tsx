"use client";

import { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { WeeklyScorePoint } from "@/lib/queries";

// 12 managers is well past the ~8-series safe ceiling for simultaneous
// categorical lines, so the default view shows every team as a muted
// context line plus the league median, and lets the viewer pick ONE team
// to highlight in the accent color - never more than two real colors.
export function WeeklyScoresChart({ data }: { data: WeeklyScorePoint[] }) {
  const owners = useMemo(() => [...new Set(data.map((d) => d.owner))].sort(), [data]);
  const [highlighted, setHighlighted] = useState<string>(owners[0] ?? "");

  const weeks = useMemo(() => [...new Set(data.map((d) => d.week))].sort((a, b) => a - b), [data]);

  const chartRows = useMemo(() => {
    return weeks.map((week) => {
      const weekPoints = data.filter((d) => d.week === week);
      const values = weekPoints.map((d) => d.points).sort((a, b) => a - b);
      const mid = Math.floor(values.length / 2);
      const median = values.length % 2 === 0 ? (values[mid - 1] + values[mid]) / 2 : values[mid];

      const row: Record<string, number | string> = { week, median: Math.round(median * 100) / 100 };
      for (const owner of owners) {
        const point = weekPoints.find((d) => d.owner === owner);
        if (point) row[owner] = point.points;
      }
      return row;
    });
  }, [data, weeks, owners]);

  return (
    <div style={{ background: "var(--surface)" }} className="rounded-lg border p-4">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          Weekly Team Scores
        </h3>
        <label className="text-sm flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
          Highlight:
          <select
            value={highlighted}
            onChange={(e) => setHighlighted(e.target.value)}
            className="rounded border px-2 py-1 text-sm"
            style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--foreground)" }}
          >
            {owners.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
      </div>
      <ResponsiveContainer width="100%" height={340}>
        <LineChart data={chartRows} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
          <CartesianGrid stroke="var(--gridline)" vertical={false} />
          <XAxis
            dataKey="week"
            stroke="var(--baseline)"
            tick={{ fill: "var(--text-muted)", fontSize: 12 }}
            tickLine={false}
            label={{ value: "Week", position: "insideBottom", offset: -2, fill: "var(--text-muted)", fontSize: 12 }}
          />
          <YAxis
            stroke="var(--baseline)"
            tick={{ fill: "var(--text-muted)", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <Tooltip
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 13,
            }}
            labelFormatter={(w) => `Week ${w}`}
          />
          {owners
            .filter((o) => o !== highlighted)
            .map((owner) => (
              <Line
                key={owner}
                type="monotone"
                dataKey={owner}
                stroke="var(--text-muted)"
                strokeOpacity={0.35}
                strokeWidth={1.5}
                dot={false}
                legendType="none"
                isAnimationActive={false}
              />
            ))}
          <Line
            type="monotone"
            dataKey="median"
            name="League median"
            stroke="var(--series-1)"
            strokeWidth={2}
            strokeDasharray="4 3"
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey={highlighted}
            name={highlighted}
            stroke="var(--series-2)"
            strokeWidth={2.5}
            dot={{ r: 3, fill: "var(--series-2)" }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
          <Legend
            wrapperStyle={{ fontSize: 13, color: "var(--text-secondary)" }}
            formatter={(value) => <span style={{ color: "var(--text-secondary)" }}>{value}</span>}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
