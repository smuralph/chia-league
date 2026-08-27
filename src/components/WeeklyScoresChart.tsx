"use client";

import { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  ReferenceLine,
  CartesianGrid,
  Tooltip,
  Legend,
  LabelList,
  ResponsiveContainer,
} from "recharts";
import type { WeeklyScorePoint, WeeklyProjectionPoint } from "@/lib/queries";

type ViewMode = "scores" | "projection";

function DiffBarLabel(props: any) {
  const { x, y, width, height, value } = props;
  if (value === undefined || value === null) return null;
  const isPositive = value >= 0;
  const labelY = isPositive ? y - 6 : y + height + 14;
  return (
    <text x={x + width / 2} y={labelY} textAnchor="middle" fontSize={11} fill="var(--text-secondary)">
      {isPositive ? `+${value.toFixed(0)}` : value.toFixed(0)}
    </text>
  );
}

function ProjectionTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload;
  const beat = row.diff >= 0;
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        fontSize: 13,
        padding: "8px 12px",
      }}
    >
      <div style={{ color: "var(--foreground)", fontWeight: 600 }}>Week {label}</div>
      <div style={{ color: "var(--text-secondary)" }}>Actual: {row.actual.toFixed(1)}</div>
      <div style={{ color: "var(--text-secondary)" }}>Projected: {row.projected.toFixed(1)}</div>
      <div style={{ color: beat ? "var(--success)" : "var(--critical)", fontWeight: 600 }}>
        {beat ? "+" : ""}
        {row.diff.toFixed(1)} vs. projection
      </div>
    </div>
  );
}

// 12 managers is well past the ~8-series safe ceiling for simultaneous
// categorical lines, so the default view shows every team as a muted
// context line plus the league median, and lets the viewer pick ONE team
// to highlight in the accent color - never more than two real colors.
export function WeeklyScoresChart({
  scores,
  projections,
}: {
  scores: WeeklyScorePoint[];
  projections: WeeklyProjectionPoint[];
}) {
  const owners = useMemo(() => [...new Set(scores.map((d) => d.owner))].sort(), [scores]);
  const [highlighted, setHighlighted] = useState<string>(owners[0] ?? "");
  const [view, setView] = useState<ViewMode>("scores");

  const weeks = useMemo(() => [...new Set(scores.map((d) => d.week))].sort((a, b) => a - b), [scores]);

  const chartRows = useMemo(() => {
    return weeks.map((week) => {
      const weekPoints = scores.filter((d) => d.week === week);
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
  }, [scores, weeks, owners]);

  const projectionRows = useMemo(
    () =>
      projections
        .filter((p) => p.owner === highlighted)
        .sort((a, b) => a.week - b.week),
    [projections, highlighted]
  );
  const hasProjectionData = projectionRows.some((r) => r.diff !== null);

  return (
    <div style={{ background: "var(--surface)" }} className="rounded-lg border p-4">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          Weekly Performance
        </h3>
        <div className="flex items-center gap-4 flex-wrap">
          <label className="text-sm flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
            View:
            <select
              value={view}
              onChange={(e) => setView(e.target.value as ViewMode)}
              className="rounded border px-2 py-1 text-sm"
              style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--foreground)" }}
            >
              <option value="scores">Weekly Team Scores</option>
              <option value="projection">Net vs. Projection</option>
            </select>
          </label>
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
      </div>

      {view === "scores" && (
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
      )}

      {view === "projection" &&
        (hasProjectionData ? (
          <ResponsiveContainer width="100%" height={340}>
            <BarChart data={projectionRows} margin={{ top: 20, right: 16, bottom: 0, left: -8 }}>
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
                width={48}
                label={{ value: "Pts vs. proj.", angle: -90, position: "insideLeft", fill: "var(--text-muted)", fontSize: 12 }}
              />
              <ReferenceLine y={0} stroke="var(--baseline)" />
              <Tooltip content={<ProjectionTooltip />} />
              <Bar dataKey="diff" isAnimationActive={false} radius={[3, 3, 3, 3]}>
                {projectionRows.map((row, i) => (
                  <Cell key={i} fill={row.diff !== null && row.diff >= 0 ? "var(--success)" : "var(--critical)"} />
                ))}
                <LabelList dataKey="diff" content={DiffBarLabel} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <div
            className="flex items-center justify-center text-sm"
            style={{ height: 340, color: "var(--text-muted)" }}
          >
            No projected-points data available for {highlighted} this season.
          </div>
        ))}
    </div>
  );
}
