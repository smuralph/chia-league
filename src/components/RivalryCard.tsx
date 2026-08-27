import Link from "next/link";
import type { Rivalry } from "@/lib/queries";
import { slugifyOwner } from "@/lib/avatars";
import { Avatar } from "@/components/Avatar";

export function RivalryCard({ rivalry }: { rivalry: Rivalry }) {
  const { owner, opponent, wins, losses, ties, meetings, winPct, avgMargin } = rivalry;

  return (
    <div
      className="rounded-lg border p-4 flex flex-col items-center gap-3 text-center"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="flex items-center gap-3">
        <Link href={`/managers/${slugifyOwner(owner)}`} className="flex flex-col items-center gap-2">
          <Avatar owner={owner} size={56} />
          <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            {owner}
          </span>
        </Link>
        <span className="text-xs font-semibold" style={{ color: "var(--text-muted)" }}>
          vs
        </span>
        <Link href={`/managers/${slugifyOwner(opponent)}`} className="flex flex-col items-center gap-2">
          <Avatar owner={opponent} size={56} />
          <span className="text-sm font-semibold" style={{ color: "var(--foreground)" }}>
            {opponent}
          </span>
        </Link>
      </div>

      <div>
        <div className="text-sm font-medium" style={{ color: "var(--foreground)" }}>
          {wins}-{losses}
          {ties ? `-${ties}` : ""} · {(winPct * 100).toFixed(1)}%
        </div>
        <div className="text-xs mt-1" style={{ color: "var(--text-muted)" }}>
          {meetings} meeting{meetings === 1 ? "" : "s"} · ±{avgMargin.toFixed(1)} pts avg
        </div>
      </div>
    </div>
  );
}
