import Link from "next/link";
import { notFound } from "next/navigation";
import { getSeasonSummary, getSeasonStandings, getSeasonWeeklyScores, getSeasonWeeklyMatchups } from "@/lib/queries";
import { buildSeasonStory } from "@/lib/seasonStory";
import { WeeklyScoresChart } from "@/components/WeeklyScoresChart";
import { LeagueStory } from "@/components/LeagueStory";

export default async function SeasonPage({ params }: PageProps<"/seasons/[year]">) {
  const { year } = await params;
  const season = Number(year);
  if (!Number.isInteger(season)) notFound();

  const [summary, standings, weeklyScores, weeklyMatchups] = await Promise.all([
    getSeasonSummary(season),
    getSeasonStandings(season),
    getSeasonWeeklyScores(season),
    getSeasonWeeklyMatchups(season),
  ]);

  if (standings.length === 0) notFound();

  const story = buildSeasonStory(season, weeklyMatchups, standings);

  return (
    <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-10 flex flex-col gap-8">
      <div>
        <Link href="/seasons" className="text-sm" style={{ color: "var(--primary)" }}>
          ← All seasons
        </Link>
        <h1 className="text-3xl font-bold mt-2" style={{ color: "var(--foreground)" }}>
          {season} Season
        </h1>
      </div>

      <LeagueStory story={story} />

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <SummaryCard label="Champion" value={summary.champion ?? "—"} icon="🏆" />
        <SummaryCard label="Runner Up" value={summary.runnerUp ?? "—"} icon="🥈" />
        <SummaryCard
          label="Highest Scoring"
          value={summary.highestScoringTeam?.owner ?? "—"}
          sub={summary.highestScoringTeam ? summary.highestScoringTeam.points.toLocaleString(undefined, { maximumFractionDigits: 0 }) : undefined}
          icon="📈"
        />
        <SummaryCard
          label="Best Record"
          value={summary.bestRecord?.owner ?? "—"}
          sub={summary.bestRecord ? `${summary.bestRecord.wins}-${summary.bestRecord.losses}${summary.bestRecord.ties ? `-${summary.bestRecord.ties}` : ""}` : undefined}
          icon="🔥"
        />
      </section>

      <section
        className="rounded-lg border overflow-x-auto"
        style={{ background: "var(--surface)", borderColor: "var(--border)" }}
      >
        <h3 className="text-sm font-semibold p-4 pb-0" style={{ color: "var(--foreground)" }}>
          Final Standings
        </h3>
        <table className="w-full text-sm mt-2" style={{ fontVariantNumeric: "tabular-nums" }}>
          <thead>
            <tr style={{ color: "var(--text-muted)" }} className="text-left uppercase text-xs tracking-wide">
              <th className="py-2 px-4">#</th>
              <th className="py-2 px-4">Team</th>
              <th className="py-2 px-4">Owner</th>
              <th className="py-2 px-4">Record</th>
              <th className="py-2 px-4">PF</th>
              <th className="py-2 px-4">PA</th>
              <th className="py-2 px-4">Playoffs</th>
            </tr>
          </thead>
          <tbody>
            {standings.map((row) => (
              <tr key={row.owner} style={{ borderTop: "1px solid var(--gridline)" }}>
                <td className="py-2 px-4" style={{ color: "var(--text-muted)" }}>
                  {row.finalRank}
                </td>
                <td className="py-2 px-4 font-medium" style={{ color: "var(--foreground)" }}>
                  {row.teamName} {row.champion && "🏆"}
                </td>
                <td className="py-2 px-4" style={{ color: "var(--text-secondary)" }}>
                  {row.owner}
                </td>
                <td className="py-2 px-4" style={{ color: "var(--text-secondary)" }}>
                  {row.wins}-{row.losses}
                  {row.ties ? `-${row.ties}` : ""}
                </td>
                <td className="py-2 px-4" style={{ color: "var(--text-secondary)" }}>
                  {row.pointsFor.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                </td>
                <td className="py-2 px-4" style={{ color: "var(--text-secondary)" }}>
                  {row.pointsAgainst.toLocaleString(undefined, { maximumFractionDigits: 1 })}
                </td>
                <td className="py-2 px-4" style={{ color: "var(--text-secondary)" }}>
                  {row.madePlayoffs ? "✓" : ""}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <WeeklyScoresChart data={weeklyScores} />
    </main>
  );
}

function SummaryCard({ label, value, sub, icon }: { label: string; value: string; sub?: string; icon: string }) {
  return (
    <div
      className="rounded-lg border p-4 flex flex-col gap-1"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <span className="text-xs uppercase tracking-wide" style={{ color: "var(--text-muted)" }}>
        {icon} {label}
      </span>
      <span className="text-lg font-bold" style={{ color: "var(--foreground)" }}>
        {value}
      </span>
      {sub && (
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>
          {sub}
        </span>
      )}
    </div>
  );
}
