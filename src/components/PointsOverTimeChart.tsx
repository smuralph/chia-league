"use client";

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import type { SeasonPoint } from "@/lib/queries";

export function PointsOverTimeChart({ data }: { data: SeasonPoint[] }) {
  return (
    <div style={{ background: "var(--surface)" }} className="rounded-lg border p-4" >
      <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--foreground)" }}>
        League Average Points Per Team Per Week
      </h3>
      <ResponsiveContainer width="100%" height={280}>
        <LineChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: -8 }}>
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
          <Tooltip
            contentStyle={{
              background: "var(--surface)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 13,
            }}
            labelStyle={{ color: "var(--foreground)" }}
            formatter={(value) => [Number(value).toFixed(1), "Avg points"]}
          />
          <Line
            type="monotone"
            dataKey="avgPoints"
            stroke="var(--series-1)"
            strokeWidth={2}
            dot={{ r: 3, fill: "var(--series-1)" }}
            activeDot={{ r: 5 }}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
