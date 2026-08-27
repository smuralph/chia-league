"use client";

import { useMemo, useState } from "react";
import { ComposedChart, Line, Bar, Cell, XAxis, YAxis, ReferenceLine, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { MomentumPoint } from "@/lib/queries";

function MomentumTooltip({ active, payload, label }: any) {
  if (!active || !payload || payload.length === 0) return null;
  const row = payload[0]?.payload;
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
      <div style={{ color: row.diff >= 0 ? "var(--success)" : "var(--critical)" }}>
        Week diff: {row.diff >= 0 ? "+" : ""}
        {row.diff.toFixed(1)}
      </div>
      <div style={{ color: "var(--text-secondary)" }}>Cumulative: {row.cumulative >= 0 ? "+" : ""}{row.cumulative.toFixed(1)}</div>
    </div>
  );
}

export function ManagerMomentumChart({
  momentumBySeason,
}: {
  momentumBySeason: Record<number, MomentumPoint[]>;
}) {
  const seasons = useMemo(
    () => Object.keys(momentumBySeason).map(Number).sort((a, b) => b - a),
    [momentumBySeason]
  );
  const [season, setSeason] = useState<number>(seasons[0] ?? 0);

  const rows = momentumBySeason[season] ?? [];

  return (
    <div style={{ background: "var(--surface)" }} className="rounded-lg border p-4">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-3">
        <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          Momentum
        </h3>
        <label className="text-sm flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
          Season:
          <select
            value={season}
            onChange={(e) => setSeason(Number(e.target.value))}
            className="rounded border px-2 py-1 text-sm"
            style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--foreground)" }}
          >
            {seasons.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="text-xs mb-4" style={{ color: "var(--text-muted)" }}>
        Cumulative points-for minus points-against, week by week.
      </p>

      <ResponsiveContainer width="100%" height={300}>
        <ComposedChart data={rows} margin={{ top: 8, right: 16, bottom: 16, left: -8 }}>
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
            width={44}
          />
          <ReferenceLine y={0} stroke="var(--baseline)" />
          <Tooltip content={<MomentumTooltip />} />
          <Bar dataKey="diff" isAnimationActive={false} radius={[3, 3, 3, 3]} barSize={16}>
            {rows.map((r, i) => (
              <Cell key={i} fill={r.diff >= 0 ? "var(--success)" : "var(--critical)"} fillOpacity={0.5} />
            ))}
          </Bar>
          <Line
            type="monotone"
            dataKey="cumulative"
            stroke="var(--series-1)"
            strokeWidth={2.5}
            dot={{ r: 3, fill: "var(--series-1)" }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
