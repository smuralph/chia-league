"use client";

import { useMemo } from "react";
import {
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  LabelList,
  ResponsiveContainer,
} from "recharts";
import type { SeasonPoint, SeasonHigh } from "@/lib/queries";

type Row = { season: number; avgPoints: number; maxPoints: number | null; entries: SeasonHigh["entries"] };

function HighBarLabel(props: any) {
  const { x, y, width, index, rows } = props;
  const row: Row | undefined = rows[index];
  if (!row || row.maxPoints === null) return null;
  const text = row.entries.length > 1 ? "Multiple" : row.maxPoints.toFixed(1);
  return (
    <text x={x + width / 2} y={y - 6} textAnchor="middle" fontSize={11} fill="var(--text-secondary)">
      {text}
    </text>
  );
}

function ComboTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const row: Row = payload[0]?.payload;

  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
        borderRadius: 8,
        fontSize: 13,
        padding: "8px 12px",
        maxWidth: 320,
      }}
    >
      <div style={{ color: "var(--foreground)", fontWeight: 600, marginBottom: 4 }}>{label} season</div>
      <div style={{ color: "var(--series-1)" }}>League avg: {row.avgPoints.toFixed(1)} pts/week</div>
      {row.maxPoints !== null && (
        <div style={{ marginTop: 6 }}>
          <div style={{ color: "var(--series-2)", fontWeight: 600 }}>
            Season high: {row.maxPoints.toFixed(1)} pts
            {row.entries.length > 1 ? ` (tied, ${row.entries.length} teams)` : ""}
          </div>
          {row.entries.map((e, i) => (
            <div key={i} style={{ marginTop: i > 0 ? 6 : 0 }}>
              <div style={{ color: "var(--text-secondary)" }}>
                {e.teamName} ({e.owner}) — Week {e.week}
              </div>
              {e.topPlayer && (
                <div style={{ color: "var(--text-muted)", fontSize: 12, marginTop: 1 }}>
                  Top player: {e.topPlayer.pos} {e.topPlayer.name} — {e.topPlayer.fanPts.toFixed(1)} pts
                  {e.topPlayer.statsLine && <div>{e.topPlayer.statsLine}</div>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function PointsOverTimeChart({
  avgData,
  highsData,
}: {
  avgData: SeasonPoint[];
  highsData: SeasonHigh[];
}) {
  const rows: Row[] = useMemo(() => {
    const highsBySeason = new Map(highsData.map((h) => [h.season, h]));
    return avgData.map((d) => {
      const high = highsBySeason.get(d.season);
      return {
        season: d.season,
        avgPoints: d.avgPoints,
        maxPoints: high ? high.points : null,
        entries: high ? high.entries : [],
      };
    });
  }, [avgData, highsData]);

  return (
    <div style={{ background: "var(--surface)" }} className="rounded-lg border p-4">
      <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--foreground)" }}>
        League Average vs. Season-High Weekly Score
      </h3>
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={rows} margin={{ top: 20, right: 16, bottom: 0, left: -8 }}>
          <CartesianGrid stroke="var(--gridline)" vertical={false} />
          <XAxis
            dataKey="season"
            stroke="var(--baseline)"
            tick={{ fill: "var(--text-muted)", fontSize: 12 }}
            tickLine={false}
          />
          <YAxis
            stroke="var(--baseline)"
            tick={{ fill: "var(--text-muted)", fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={40}
          />
          <Tooltip content={<ComboTooltip />} />
          <Legend wrapperStyle={{ fontSize: 13, color: "var(--text-secondary)" }} />
          <Bar dataKey="maxPoints" name="Season High" fill="var(--series-2)" radius={[3, 3, 0, 0]} barSize={28} isAnimationActive={false}>
            <LabelList dataKey="maxPoints" content={(props: any) => <HighBarLabel {...props} rows={rows} />} />
          </Bar>
          <Line
            type="monotone"
            dataKey="avgPoints"
            name="League Average"
            stroke="var(--series-1)"
            strokeWidth={2}
            dot={{ r: 3, fill: "var(--series-1)" }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
