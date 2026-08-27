"use client";

import { useMemo, useState } from "react";
import type { ManagerWeekResult } from "@/lib/queries";

const RESULT_COLOR: Record<ManagerWeekResult["result"], string> = {
  W: "var(--success)",
  L: "var(--critical)",
  T: "var(--text-muted)",
};

export function ManagerWeeklyResultsTable({
  resultsBySeason,
}: {
  resultsBySeason: Record<number, ManagerWeekResult[]>;
}) {
  const seasons = useMemo(
    () => Object.keys(resultsBySeason).map(Number).sort((a, b) => b - a),
    [resultsBySeason]
  );
  const [season, setSeason] = useState<number>(seasons[0] ?? 0);

  const rows = resultsBySeason[season] ?? [];

  return (
    <div
      className="rounded-lg border overflow-x-auto"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="flex items-center justify-between p-4 pb-0 flex-wrap gap-3">
        <h3 className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
          Week by Week
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

      <table className="w-full text-sm mt-2" style={{ fontVariantNumeric: "tabular-nums" }}>
        <thead>
          <tr style={{ color: "var(--text-muted)" }} className="text-left uppercase text-xs tracking-wide">
            <th className="py-2 px-4">Week</th>
            <th className="py-2 px-4">Opponent</th>
            <th className="py-2 px-4">Result</th>
            <th className="py-2 px-4">PF</th>
            <th className="py-2 px-4">PA</th>
            <th className="py-2 px-4">Top Players</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.week} style={{ borderTop: "1px solid var(--gridline)" }}>
              <td className="py-2 px-4" style={{ color: "var(--text-muted)" }}>
                {r.week}
              </td>
              <td className="py-2 px-4" style={{ color: "var(--text-secondary)" }}>
                {r.opponent}
              </td>
              <td className="py-2 px-4 font-semibold" style={{ color: RESULT_COLOR[r.result] }}>
                {r.result}
              </td>
              <td className="py-2 px-4" style={{ color: "var(--text-secondary)" }}>
                {r.points.toLocaleString(undefined, { maximumFractionDigits: 1 })}
              </td>
              <td className="py-2 px-4" style={{ color: "var(--text-secondary)" }}>
                {r.opponentPoints.toLocaleString(undefined, { maximumFractionDigits: 1 })}
              </td>
              <td className="py-2 px-4">
                <div className="flex flex-col gap-0.5">
                  {r.topPlayers.length === 0 && <span style={{ color: "var(--text-muted)" }}>—</span>}
                  {r.topPlayers.map((p, i) => (
                    <span key={i} className="text-xs" style={{ color: "var(--text-secondary)" }}>
                      {p.name} ({p.pos}) — {p.fanPts.toFixed(1)} pts
                    </span>
                  ))}
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
