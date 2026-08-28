"use client";

import { useState } from "react";
import type { ManagerLeaderboardRow } from "@/lib/queries";

type SortKey = "winPct" | "wins" | "championships" | "podiums" | "totalPoints" | "playoffAppearances";

const COLUMNS: { key: SortKey; label: string }[] = [
  { key: "wins", label: "Wins" },
  { key: "winPct", label: "Win %" },
  { key: "championships", label: "Titles" },
  { key: "podiums", label: "Podiums" },
  { key: "playoffAppearances", label: "Playoffs" },
  { key: "totalPoints", label: "Points" },
];

export function ManagerLeaderboardTable({ rows }: { rows: ManagerLeaderboardRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("winPct");

  const sorted = [...rows].sort((a, b) => b[sortKey] - a[sortKey]);

  return (
    <div style={{ background: "var(--surface)" }} className="rounded-lg border p-4 overflow-x-auto">
      <h3 className="text-sm font-semibold mb-4" style={{ color: "var(--foreground)" }}>
        Manager Rankings · 2018 – 2025
      </h3>
      <table className="w-full text-sm" style={{ fontVariantNumeric: "tabular-nums" }}>
        <thead>
          <tr style={{ color: "var(--text-muted)" }} className="text-left uppercase text-xs tracking-wide">
            <th className="py-2 pr-3">#</th>
            <th className="py-2 pr-3">Manager</th>
            <th className="py-2 pr-3">Record</th>
            {COLUMNS.map((col) => (
              <th key={col.key} className="py-2 pr-3">
                <button
                  onClick={() => setSortKey(col.key)}
                  className="uppercase text-xs tracking-wide"
                  style={{
                    color: sortKey === col.key ? "var(--primary)" : "var(--text-muted)",
                    fontWeight: sortKey === col.key ? 700 : 500,
                  }}
                >
                  {col.label}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr key={r.owner} style={{ borderTop: "1px solid var(--gridline)" }}>
              <td className="py-2 pr-3" style={{ color: "var(--text-muted)" }}>
                {i + 1}
              </td>
              <td className="py-2 pr-3 font-medium" style={{ color: "var(--foreground)" }}>
                {r.owner}
              </td>
              <td className="py-2 pr-3" style={{ color: "var(--text-secondary)" }}>
                {r.wins}-{r.losses}
                {r.ties ? `-${r.ties}` : ""}
              </td>
              <td className="py-2 pr-3" style={{ color: "var(--text-secondary)" }}>
                {r.wins}
              </td>
              <td className="py-2 pr-3" style={{ color: "var(--text-secondary)" }}>
                {(r.winPct * 100).toFixed(1)}%
              </td>
              <td className="py-2 pr-3" style={{ color: "var(--text-secondary)" }}>
                {r.championships}
              </td>
              <td className="py-2 pr-3" style={{ color: "var(--text-secondary)" }}>
                {r.podiums}
              </td>
              <td className="py-2 pr-3" style={{ color: "var(--text-secondary)" }}>
                {r.playoffAppearances}
              </td>
              <td className="py-2 pr-3" style={{ color: "var(--text-secondary)" }}>
                {r.totalPoints.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
