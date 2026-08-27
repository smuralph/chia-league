"use client";

import { useMemo, useState } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { ManagerWinPctPoint } from "@/lib/queries";

type Mode = "season" | "cumulative";

export function ManagerWinPctChart({ owner, data }: { owner: string; data: ManagerWinPctPoint[] }) {
  const [mode, setMode] = useState<Mode>("season");

  const rows = useMemo(() => {
    if (mode === "season") {
      return data.map((d) => ({
        season: d.season,
        manager: Math.round(d.managerWinPct * 1000) / 10,
        league: Math.round(d.leagueAvgWinPct * 1000) / 10,
      }));
    }
    let cumWins = 0;
    let cumGames = 0;
    let leagueSum = 0;
    return data.map((d, i) => {
      cumWins += d.managerWins;
      cumGames += d.managerGames;
      leagueSum += d.leagueAvgWinPct;
      return {
        season: d.season,
        manager: cumGames > 0 ? Math.round((cumWins / cumGames) * 1000) / 10 : 0,
        league: Math.round((leagueSum / (i + 1)) * 1000) / 10,
      };
    });
  }, [data, mode]);

  return (
    <div style={{ background: "var(--surface)" }} className="rounded-lg border p-4">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          Win % Trend
        </h3>
        <label className="text-sm flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
          View:
          <select
            value={mode}
            onChange={(e) => setMode(e.target.value as Mode)}
            className="rounded border px-2 py-1 text-sm"
            style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--foreground)" }}
          >
            <option value="season">Per Season</option>
            <option value="cumulative">Cumulative</option>
          </select>
        </label>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={rows} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
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
            width={48}
            unit="%"
          />
          <Tooltip
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 13,
            }}
            formatter={(value) => `${value}%`}
            labelFormatter={(season) => `${season} season`}
          />
          <Line
            type="monotone"
            dataKey="league"
            name="League average"
            stroke="var(--text-muted)"
            strokeOpacity={0.6}
            strokeDasharray="4 3"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
          <Line
            type="monotone"
            dataKey="manager"
            name={owner}
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
