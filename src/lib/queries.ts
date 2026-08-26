import { pool } from "./db";

export type LeagueKpis = {
  seasons: number;
  managers: number;
  teamGamesPlayed: number;
  championships: number;
  highestSingleSeasonWinPct: { pct: number; owner: string; season: number } | null;
  mostCareerWins: { wins: number; owner: string } | null;
  mostCareerPoints: { points: number; owner: string } | null;
  mostPlayoffAppearances: { count: number; owner: string } | null;
};

export async function getLeagueKpis(): Promise<LeagueKpis> {
  const [seasons, managers, games, champs, bestSeasonWinPct, careerWins, careerPoints, playoffApps] =
    await Promise.all([
      pool.query(`SELECT COUNT(DISTINCT season) AS n FROM teams_by_season`),
      pool.query(`SELECT COUNT(*) AS n FROM owners`),
      pool.query(`SELECT COUNT(*) AS n FROM weekly_matchups`),
      pool.query(`SELECT COUNT(*) AS n FROM teams_by_season WHERE champion = true`),
      pool.query(`
        SELECT o.name AS owner, tbs.season,
          ROUND(tbs.wins::numeric / NULLIF(tbs.wins + tbs.losses + tbs.ties, 0), 4) AS pct
        FROM teams_by_season tbs JOIN owners o ON o.id = tbs.owner_id
        ORDER BY pct DESC NULLS LAST LIMIT 1
      `),
      pool.query(`
        SELECT o.name AS owner, SUM(tbs.wins) AS wins
        FROM teams_by_season tbs JOIN owners o ON o.id = tbs.owner_id
        GROUP BY o.name ORDER BY wins DESC LIMIT 1
      `),
      pool.query(`
        SELECT o.name AS owner, SUM(tbs.points_for) AS points
        FROM teams_by_season tbs JOIN owners o ON o.id = tbs.owner_id
        GROUP BY o.name ORDER BY points DESC LIMIT 1
      `),
      pool.query(`
        SELECT o.name AS owner, COUNT(*) AS n
        FROM teams_by_season tbs JOIN owners o ON o.id = tbs.owner_id
        WHERE tbs.made_playoffs = true
        GROUP BY o.name ORDER BY n DESC LIMIT 1
      `),
    ]);

  const bp = bestSeasonWinPct.rows[0];
  const cw = careerWins.rows[0];
  const cp = careerPoints.rows[0];
  const pa = playoffApps.rows[0];

  return {
    seasons: Number(seasons.rows[0].n),
    managers: Number(managers.rows[0].n),
    teamGamesPlayed: Number(games.rows[0].n),
    championships: Number(champs.rows[0].n),
    highestSingleSeasonWinPct: bp ? { pct: Number(bp.pct), owner: bp.owner, season: bp.season } : null,
    mostCareerWins: cw ? { wins: Number(cw.wins), owner: cw.owner } : null,
    mostCareerPoints: cp ? { points: Number(cp.points), owner: cp.owner } : null,
    mostPlayoffAppearances: pa ? { count: Number(pa.n), owner: pa.owner } : null,
  };
}

export type ManagerLeaderboardRow = {
  owner: string;
  wins: number;
  losses: number;
  ties: number;
  winPct: number;
  championships: number;
  playoffAppearances: number;
  totalPoints: number;
  seasons: number;
};

export async function getManagerLeaderboard(): Promise<ManagerLeaderboardRow[]> {
  const res = await pool.query(`
    SELECT
      o.name AS owner,
      SUM(tbs.wins) AS wins,
      SUM(tbs.losses) AS losses,
      SUM(tbs.ties) AS ties,
      ROUND(SUM(tbs.wins)::numeric / NULLIF(SUM(tbs.wins + tbs.losses + tbs.ties), 0), 4) AS win_pct,
      SUM(CASE WHEN tbs.champion THEN 1 ELSE 0 END) AS championships,
      SUM(CASE WHEN tbs.made_playoffs THEN 1 ELSE 0 END) AS playoff_appearances,
      SUM(tbs.points_for) AS total_points,
      COUNT(*) AS seasons
    FROM teams_by_season tbs JOIN owners o ON o.id = tbs.owner_id
    GROUP BY o.name
    ORDER BY win_pct DESC
  `);
  return res.rows.map((r: Record<string, any>) => ({
    owner: r.owner,
    wins: Number(r.wins),
    losses: Number(r.losses),
    ties: Number(r.ties),
    winPct: Number(r.win_pct),
    championships: Number(r.championships),
    playoffAppearances: Number(r.playoff_appearances),
    totalPoints: Number(r.total_points),
    seasons: Number(r.seasons),
  }));
}

export type SeasonPoint = { season: number; avgPoints: number };

export async function getPointsOverTime(): Promise<SeasonPoint[]> {
  const res = await pool.query(`
    SELECT season, ROUND(AVG(points_scored)::numeric, 2) AS avg_points
    FROM weekly_matchups GROUP BY season ORDER BY season
  `);
  return res.rows.map((r: Record<string, any>) => ({ season: Number(r.season), avgPoints: Number(r.avg_points) }));
}

export type SeasonListItem = { season: number; champion: string | null };

export async function getSeasonsList(): Promise<SeasonListItem[]> {
  const res = await pool.query(`
    SELECT tbs.season, o.name AS champion
    FROM teams_by_season tbs
    JOIN owners o ON o.id = tbs.owner_id
    WHERE tbs.champion = true
    ORDER BY tbs.season DESC
  `);
  return res.rows.map((r: Record<string, any>) => ({ season: Number(r.season), champion: r.champion }));
}

export type SeasonSummary = {
  champion: string | null;
  runnerUp: string | null;
  highestScoringTeam: { owner: string; points: number } | null;
  bestRecord: { owner: string; wins: number; losses: number; ties: number } | null;
};

export async function getSeasonSummary(season: number): Promise<SeasonSummary> {
  const res = await pool.query(
    `
    SELECT o.name AS owner, tbs.final_rank, tbs.wins, tbs.losses, tbs.ties, tbs.points_for, tbs.champion
    FROM teams_by_season tbs JOIN owners o ON o.id = tbs.owner_id
    WHERE tbs.season = $1
  `,
    [season]
  );
  const rows: Record<string, any>[] = res.rows;
  const champion = rows.find((r) => r.champion)?.owner ?? null;
  const runnerUp = rows.find((r) => Number(r.final_rank) === 2)?.owner ?? null;
  const highest = [...rows].sort((a, b) => Number(b.points_for) - Number(a.points_for))[0];
  const bestRecordRow = [...rows].sort((a, b) => Number(b.wins) - Number(a.wins))[0];

  return {
    champion,
    runnerUp,
    highestScoringTeam: highest ? { owner: highest.owner, points: Number(highest.points_for) } : null,
    bestRecord: bestRecordRow
      ? { owner: bestRecordRow.owner, wins: Number(bestRecordRow.wins), losses: Number(bestRecordRow.losses), ties: Number(bestRecordRow.ties) }
      : null,
  };
}

export type SeasonStandingsRow = {
  finalRank: number;
  teamName: string;
  owner: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  madePlayoffs: boolean;
  champion: boolean;
};

export async function getSeasonStandings(season: number): Promise<SeasonStandingsRow[]> {
  const res = await pool.query(
    `
    SELECT tbs.final_rank, tbs.team_name, o.name AS owner, tbs.wins, tbs.losses, tbs.ties,
      tbs.points_for, tbs.points_against, tbs.made_playoffs, tbs.champion
    FROM teams_by_season tbs JOIN owners o ON o.id = tbs.owner_id
    WHERE tbs.season = $1
    ORDER BY tbs.final_rank
  `,
    [season]
  );
  return res.rows.map((r: Record<string, any>) => ({
    finalRank: Number(r.final_rank),
    teamName: r.team_name,
    owner: r.owner,
    wins: Number(r.wins),
    losses: Number(r.losses),
    ties: Number(r.ties),
    pointsFor: Number(r.points_for),
    pointsAgainst: Number(r.points_against),
    madePlayoffs: r.made_playoffs,
    champion: r.champion,
  }));
}

export type RankTrendPoint = { season: number; owner: string; finalRank: number; winPctRank: number };

// winPctRank is computed independently of the league's official final_rank
// (which can reflect playoff results/tiebreakers) - it's a pure regular-season
// performance ranking, so the two can diverge and both are worth showing.
export async function getRankTrends(): Promise<RankTrendPoint[]> {
  const res = await pool.query(`
    SELECT
      tbs.season,
      o.name AS owner,
      tbs.final_rank,
      RANK() OVER (
        PARTITION BY tbs.season
        ORDER BY (tbs.wins::numeric / NULLIF(tbs.wins + tbs.losses + tbs.ties, 0)) DESC, tbs.points_for DESC
      ) AS win_pct_rank
    FROM teams_by_season tbs JOIN owners o ON o.id = tbs.owner_id
    ORDER BY tbs.season, win_pct_rank
  `);
  return res.rows.map((r: Record<string, any>) => ({
    season: Number(r.season),
    owner: r.owner,
    finalRank: Number(r.final_rank),
    winPctRank: Number(r.win_pct_rank),
  }));
}

export type WeeklyMatchupRow = {
  week: number;
  owner: string;
  opponentOwner: string;
  points: number;
  opponentPoints: number;
};

export async function getSeasonWeeklyMatchups(season: number): Promise<WeeklyMatchupRow[]> {
  const res = await pool.query(
    `
    SELECT wm.week, o.name AS owner, oo.name AS opponent_owner, wm.points_scored AS points, wm.opponent_points
    FROM weekly_matchups wm
    JOIN owners o ON o.id = wm.owner_id
    LEFT JOIN owners oo ON oo.id = wm.opponent_owner_id
    WHERE wm.season = $1
    ORDER BY wm.week, o.name
  `,
    [season]
  );
  return res.rows.map((r: Record<string, any>) => ({
    week: Number(r.week),
    owner: r.owner,
    opponentOwner: r.opponent_owner,
    points: Number(r.points),
    opponentPoints: Number(r.opponent_points),
  }));
}

export type WeeklyScorePoint = { week: number; owner: string; points: number };

export async function getSeasonWeeklyScores(season: number): Promise<WeeklyScorePoint[]> {
  const res = await pool.query(
    `
    SELECT wm.week, o.name AS owner, wm.points_scored AS points
    FROM weekly_matchups wm JOIN owners o ON o.id = wm.owner_id
    WHERE wm.season = $1
    ORDER BY wm.week, o.name
  `,
    [season]
  );
  return res.rows.map((r: Record<string, any>) => ({ week: Number(r.week), owner: r.owner, points: Number(r.points) }));
}
