"use client";

import { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { RankTrendPoint } from "@/lib/queries";

type Metric = "finalRank" | "winPctRank";

type DotProps = { cx?: number; cy?: number };

// A larger invisible hit-target layered over the small visible dot, so
// clicking near a mark (not just the exact 2.5px center) selects that owner.
function clickableMutedDot(owner: string, onSelect: (owner: string) => void) {
  return function MutedDot(props: DotProps) {
    const { cx, cy } = props;
    if (cx === undefined || cy === undefined) return null;
    return (
      <g style={{ cursor: "pointer" }} onClick={() => onSelect(owner)}>
        <circle cx={cx} cy={cy} r={9} fill="transparent" />
        <circle cx={cx} cy={cy} r={2.5} fill="var(--text-muted)" fillOpacity={0.35} />
      </g>
    );
  };
}

// Same pattern as WeeklyScoresChart: 12 managers is past the safe ceiling for
// simultaneous categorical lines, so every owner renders as a muted context
// line and the viewer picks ONE to highlight in the accent color.
export function BumpChart({ data }: { data: RankTrendPoint[] }) {
  const owners = useMemo(() => [...new Set(data.map((d) => d.owner))].sort(), [data]);
  const seasons = useMemo(() => [...new Set(data.map((d) => d.season))].sort((a, b) => a - b), [data]);
  const maxRank = useMemo(() => Math.max(...data.map((d) => d.finalRank), ...data.map((d) => d.winPctRank)), [data]);

  const [highlighted, setHighlighted] = useState<string>(owners[0] ?? "");
  const [metric, setMetric] = useState<Metric>("finalRank");

  const chartRows = useMemo(() => {
    return seasons.map((season) => {
      const row: Record<string, number> = { season };
      for (const owner of owners) {
        const point = data.find((d) => d.season === season && d.owner === owner);
        if (point) row[owner] = point[metric];
      }
      return row;
    });
  }, [data, seasons, owners, metric]);

  return (
    <div style={{ background: "var(--surface)" }} className="rounded-lg border p-4">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          Who Dominated When?
        </h3>
        <div className="flex items-center gap-4 flex-wrap">
          <label className="text-sm flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
            Rank by:
            <select
              value={metric}
              onChange={(e) => setMetric(e.target.value as Metric)}
              className="rounded border px-2 py-1 text-sm"
              style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--foreground)" }}
            >
              <option value="finalRank">Final Standing</option>
              <option value="winPctRank">Win % Rank</option>
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

      <ResponsiveContainer width="100%" height={420}>
        <LineChart data={chartRows} margin={{ top: 16, right: 16, bottom: 0, left: -8 }}>
          <CartesianGrid stroke="var(--gridline)" vertical={false} />
          <XAxis
            dataKey="season"
            stroke="var(--baseline)"
            tick={{ fill: "var(--text-muted)", fontSize: 12 }}
            tickLine={false}
          />
          <YAxis
            reversed
            domain={[1, maxRank]}
            allowDecimals={false}
            ticks={Array.from({ length: maxRank }, (_, i) => i + 1)}
            stroke="var(--baseline)"
            tick={{ fill: "var(--text-muted)", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={32}
            label={{ value: "Rank", angle: -90, position: "insideLeft", fill: "var(--text-muted)", fontSize: 12 }}
          />
          <Tooltip
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 13,
            }}
            labelFormatter={(season) => `${season} season`}
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
                dot={clickableMutedDot(owner, setHighlighted)}
                connectNulls
                isAnimationActive={false}
                style={{ cursor: "pointer" }}
                onClick={() => setHighlighted(owner)}
              />
            ))}
          <Line
            type="monotone"
            dataKey={highlighted}
            name={highlighted}
            stroke="var(--series-2)"
            strokeWidth={2.5}
            dot={{ r: 4, fill: "var(--series-2)" }}
            activeDot={{ r: 6 }}
            connectNulls
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
