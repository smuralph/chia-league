import { getLeagueKpis, getManagerLeaderboard, getPointsOverTime, getSeasonHighs, getTeamNameCloud } from "@/lib/queries";
import { KpiCard } from "@/components/KpiCard";
import { ManagerLeaderboardTable } from "@/components/ManagerLeaderboardTable";
import { PointsOverTimeChart } from "@/components/PointsOverTimeChart";
import { TeamNameCloud } from "@/components/TeamNameCloud";

export default async function Home() {
  const [kpis, leaderboard, pointsOverTime, seasonHighs, teamNames] = await Promise.all([
    getLeagueKpis(),
    getManagerLeaderboard(),
    getPointsOverTime(),
    getSeasonHighs(),
    getTeamNameCloud(),
  ]);

  return (
    <main className="flex-1 max-w-5xl w-full mx-auto px-6 py-10 flex flex-col gap-8">
      <TeamNameCloud names={teamNames} title="Chia's Battle for the Sword" subtitle="League at a Glance · 2018 – 2026" />

      <section className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <KpiCard label="Team-Games Played" value={kpis.teamGamesPlayed.toLocaleString()} />
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
        <KpiCard
          label="Most Championships"
          value={kpis.mostChampionships ? String(kpis.mostChampionships.count) : "—"}
          sub={kpis.mostChampionships?.owner}
        />
        <KpiCard
          label="Highest Win Streak"
          value={kpis.longestWinStreak ? `${kpis.longestWinStreak.length} games` : "—"}
          sub={kpis.longestWinStreak ? `${kpis.longestWinStreak.owner}, ${kpis.longestWinStreak.season}` : undefined}
        />
        <KpiCard
          label="Highest Losing Streak"
          value={kpis.longestLossStreak ? `${kpis.longestLossStreak.length} games` : "—"}
          sub={kpis.longestLossStreak ? `${kpis.longestLossStreak.owner}, ${kpis.longestLossStreak.season}` : undefined}
        />
      </section>

      <PointsOverTimeChart avgData={pointsOverTime} highsData={seasonHighs} />

      <ManagerLeaderboardTable rows={leaderboard} />
    </main>
  );
}
