import Link from "next/link";
import { notFound } from "next/navigation";
import {
  getManagersList,
  getManagerDetail,
  getManagerWinPctTrend,
  getManagerMomentum,
  getManagerWeeklyResults,
} from "@/lib/queries";
import { slugifyOwner } from "@/lib/avatars";
import { Avatar } from "@/components/Avatar";
import { KpiCard } from "@/components/KpiCard";
import { ManagerWinPctChart } from "@/components/ManagerWinPctChart";
import { DraftVsFinishChart } from "@/components/DraftVsFinishChart";
import { ManagerMomentumChart } from "@/components/ManagerMomentumChart";
import { ManagerWeeklyResultsTable } from "@/components/ManagerWeeklyResultsTable";
import type { MomentumPoint, ManagerWeekResult } from "@/lib/queries";

// A couple of early seasons (2014-2015) carry final_rank/draft_order values
// up to 14 even though only 12 teams played that year - a quirk in the
// scraped historical source data, not a bug here. Extended to cover it.
const ORDINAL = [
  "",
  "1st",
  "2nd",
  "3rd",
  "4th",
  "5th",
  "6th",
  "7th",
  "8th",
  "9th",
  "10th",
  "11th",
  "12th",
  "13th",
  "14th",
];

export default async function ManagerPage({ params }: PageProps<"/managers/[slug]">) {
  const { slug } = await params;

  const managers = await getManagersList();
  const match = managers.find((m) => slugifyOwner(m.owner) === slug);
  if (!match) notFound();

  const owner = match.owner;
  const [detail, winPctTrend] = await Promise.all([getManagerDetail(owner), getManagerWinPctTrend(owner)]);
  if (!detail) notFound();

  const [momentumEntries, weeklyResultsEntries] = await Promise.all([
    Promise.all(
      detail.seasons.map(async (s) => [s.season, await getManagerMomentum(owner, s.season)] as [number, MomentumPoint[]])
    ),
    Promise.all(
      detail.seasons.map(
        async (s) => [s.season, await getManagerWeeklyResults(owner, s.season)] as [number, ManagerWeekResult[]]
      )
    ),
  ]);
  const momentumBySeason = Object.fromEntries(momentumEntries);
  const weeklyResultsBySeason = Object.fromEntries(weeklyResultsEntries);

  const { career, seasons } = detail;

  return (
    <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-10 flex flex-col gap-8">
      <div>
        <Link href="/managers" className="text-sm" style={{ color: "var(--primary)" }}>
          ← All managers
        </Link>
        <div className="flex items-center gap-4 mt-2">
          <Avatar owner={owner} size={72} />
          <div>
            <h1 className="text-3xl font-bold" style={{ color: "var(--foreground)" }}>
              {owner}
            </h1>
            <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
              Member since {career.firstSeason} · {career.seasonsPlayed} season{career.seasonsPlayed === 1 ? "" : "s"}
            </p>
            {career.championships > 0 && <p className="text-sm mt-1">{"🏆".repeat(career.championships)}</p>}
          </div>
        </div>
      </div>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard label="Career Record" value={`${career.wins}-${career.losses}${career.ties ? `-${career.ties}` : ""}`} />
        <KpiCard label="Win %" value={`${(career.winPct * 100).toFixed(1)}%`} />
        <KpiCard label="Championships" value={String(career.championships)} />
        <KpiCard label="Playoff Appearances" value={String(career.playoffAppearances)} />
        <KpiCard label="Total Points" value={career.totalPoints.toLocaleString(undefined, { maximumFractionDigits: 0 })} />
        <KpiCard label="Avg Points / Week" value={career.avgPointsPerWeek.toFixed(1)} />
        <KpiCard label="Best Finish" value={ORDINAL[career.bestFinish] ?? `#${career.bestFinish}`} />
        <KpiCard label="Avg Finish" value={`#${career.avgFinish.toFixed(1)}`} />
      </section>

      <ManagerWinPctChart owner={owner} data={winPctTrend} />

      <DraftVsFinishChart seasons={seasons} />

      <section
        className="rounded-lg border overflow-x-auto"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <h3 className="text-sm font-semibold p-4 pb-0" style={{ color: "var(--foreground)" }}>
          Season by Season
        </h3>
        <table className="w-full text-sm mt-2" style={{ fontVariantNumeric: "tabular-nums" }}>
          <thead>
            <tr style={{ color: "var(--text-muted)" }} className="text-left uppercase text-xs tracking-wide">
              <th className="py-2 px-4">Season</th>
              <th className="py-2 px-4">Team</th>
              <th className="py-2 px-4">Record</th>
              <th className="py-2 px-4">PF</th>
              <th className="py-2 px-4">PA</th>
              <th className="py-2 px-4">Finish</th>
              <th className="py-2 px-4">Playoffs</th>
            </tr>
          </thead>
          <tbody>
            {[...seasons].reverse().map((s) => (
              <tr key={s.season} style={{ borderTop: "1px solid var(--gridline)" }}>
                <td className="py-2 px-4" style={{ color: "var(--text-secondary)" }}>
                  <Link href={`/seasons/${s.season}`} style={{ color: "var(--primary)" }}>
                    {s.season}
                  </Link>
                </td>
                <td className="py-2 px-4 font-medium" style={{ color: "var(--foreground)" }}>
                  {s.teamName} {s.champion && "🏆"}
                </td>
                <td className="py-2 px-4" style={{ color: "var(--text-secondary)" }}>
                  {s.wins}-{s.losses}
                  {s.ties ? `-${s.ties}` : ""}
                </td>
                <td className="py-2 px-4" style={{ color: "var(--text-secondary)" }}>
                  {s.pointsFor.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                </td>
                <td className="py-2 px-4" style={{ color: "var(--text-secondary)" }}>
                  {s.pointsAgainst.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                </td>
                <td className="py-2 px-4" style={{ color: "var(--text-secondary)" }}>
                  {ORDINAL[s.finalRank] ?? `#${s.finalRank}`}
                </td>
                <td className="py-2 px-4" style={{ color: "var(--text-secondary)" }}>
                  {s.madePlayoffs ? "✓" : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <ManagerMomentumChart momentumBySeason={momentumBySeason} />

      <ManagerWeeklyResultsTable resultsBySeason={weeklyResultsBySeason} />
    </main>
  );
}
