"use client";

import { useRouter } from "next/navigation";
import type { SeasonListItem } from "@/lib/queries";

export function SeasonJumpSelect({ seasons }: { seasons: SeasonListItem[] }) {
  const router = useRouter();

  return (
    <label className="text-sm flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
      Jump to season:
      <select
        defaultValue="all"
        onChange={(e) => {
          if (e.target.value !== "all") router.push(`/seasons/${e.target.value}`);
        }}
        className="rounded border px-2 py-1 text-sm"
        style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--foreground)" }}
      >
        <option value="all">Select a season</option>
        {seasons.map((s) => (
          <option key={s.season} value={s.season}>
            {s.season}
          </option>
        ))}
      </select>
    </label>
  );
}
