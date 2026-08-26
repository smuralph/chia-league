import { getLeagueKpis, getManagerLeaderboard, getPointsOverTime } from "@/lib/queries";
import { KpiCard } from "@/components/KpiCard";
import { ManagerLeaderboardTable } from "@/components/ManagerLeaderboardTable";
import { PointsOverTimeChart } from "@/components/PointsOverTimeChart";

export default async function Home() {
  const [kpis, leaderboard, pointsOverTime] = await Promise.all([
    getLeagueKpis(),
    getManagerLeaderboard(),
    getPointsOverTime(),
  ]);

  return (
    <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-10 flex flex-col gap-8">
      <section className="text-center py-6">
        <h1 className="text-3xl font-bold" style={{ color: "var(--foreground)" }}>
          🏈 Chia League
        </h1>
        <p className="mt-1" style={{ color: "var(--text-secondary)" }}>
          The League at a Glance &middot; 2014–2025
        </p>
      </section>

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard label="Seasons" value={String(kpis.seasons)} />
        <KpiCard label="Managers" value={String(kpis.managers)} />
        <KpiCard label="Team-Games Played" value={kpis.teamGamesPlayed.toLocaleString()} />
        <KpiCard label="Championships" value={String(kpis.championships)} />
        <KpiCard
          label="Best Single-Season Win %"
          value={kpis.highestSingleSeasonWinPct ? `${(kpis.highestSingleSeasonWinPct.pct * 100).toFixed(1)}%` : "—"}
          sub={
            kpis.highestSingleSeasonWinPct
              ? `${kpis.highestSingleSeasonWinPct.owner}, ${kpis.highestSingleSeasonWinPct.season}`
              : undefined
          }
        />
        <KpiCard
          label="Most Career Wins"
          value={kpis.mostCareerWins ? String(kpis.mostCareerWins.wins) : "—"}
          sub={kpis.mostCareerWins?.owner}
        />
        <KpiCard
          label="Most Career Points"
          value={kpis.mostCareerPoints ? kpis.mostCareerPoints.points.toLocaleString(undefined, { maximumFractionDigits: 0 }) : "—"}
          sub={kpis.mostCareerPoints?.owner}
        />
        <KpiCard
          label="Most Playoff Appearances"
          value={kpis.mostPlayoffAppearances ? String(kpis.mostPlayoffAppearances.count) : "—"}
          sub={kpis.mostPlayoffAppearances?.owner}
        />
      </section>

      <PointsOverTimeChart data={pointsOverTime} />

      <ManagerLeaderboardTable rows={leaderboard} />
    </main>
  );
}
