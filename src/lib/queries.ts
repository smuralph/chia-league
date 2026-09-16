import { pool } from "./db";
import { buildSeasonStory } from "./seasonStory";

// Chris Varughese wasn't an owner in 2016-2017, so any season before 2018
// makes career/all-time comparisons uneven across managers (different
// numbers of seasons played). Every cross-season stat on the site is scoped
// to 2018+ so every current owner is compared over the same 8 seasons.
// Single-season, per-season views (season pages, the bump chart) are NOT
// affected - a within-season comparison has no such fairness problem.
export const MIN_STAT_SEASON = 2018;

export type LeagueKpis = {
  teamGamesPlayed: number;
  highestSingleSeasonWinPct: { pct: number; owner: string; season: number } | null;
  mostCareerWins: { wins: number; owner: string } | null;
  mostCareerPoints: { points: number; owner: string } | null;
  mostPlayoffAppearances: { count: number; owner: string } | null;
  mostChampionships: { count: number; owner: string } | null;
  longestWinStreak: { length: number; owner: string; season: number } | null;
  longestLossStreak: { length: number; owner: string; season: number } | null;
};

export async function getLeagueKpis(): Promise<LeagueKpis> {
  const [games, bestSeasonWinPct, careerWins, careerPoints, playoffApps, championships] = await Promise.all([
    pool.query(`SELECT COUNT(*) AS n FROM weekly_matchups WHERE season >= $1`, [MIN_STAT_SEASON]),
    pool.query(
      `
        SELECT o.name AS owner, tbs.season,
          ROUND(tbs.wins::numeric / NULLIF(tbs.wins + tbs.losses + tbs.ties, 0), 4) AS pct
        FROM teams_by_season tbs JOIN owners o ON o.id = tbs.owner_id
        WHERE tbs.season >= $1
        ORDER BY pct DESC NULLS LAST LIMIT 1
      `,
      [MIN_STAT_SEASON]
    ),
    pool.query(
      `
        SELECT o.name AS owner, SUM(tbs.wins) AS wins
        FROM teams_by_season tbs JOIN owners o ON o.id = tbs.owner_id
        WHERE tbs.season >= $1
        GROUP BY o.name ORDER BY wins DESC LIMIT 1
      `,
      [MIN_STAT_SEASON]
    ),
    pool.query(
      `
        SELECT o.name AS owner, SUM(tbs.points_for) AS points
        FROM teams_by_season tbs JOIN owners o ON o.id = tbs.owner_id
        WHERE tbs.season >= $1
        GROUP BY o.name ORDER BY points DESC LIMIT 1
      `,
      [MIN_STAT_SEASON]
    ),
    pool.query(
      `
        SELECT o.name AS owner, COUNT(*) AS n
        FROM teams_by_season tbs JOIN owners o ON o.id = tbs.owner_id
        WHERE tbs.made_playoffs = true AND tbs.season >= $1
        GROUP BY o.name ORDER BY n DESC LIMIT 1
      `,
      [MIN_STAT_SEASON]
    ),
    pool.query(
      `
        SELECT o.name AS owner, COUNT(*) AS n
        FROM teams_by_season tbs JOIN owners o ON o.id = tbs.owner_id
        WHERE tbs.champion = true AND tbs.season >= $1
        GROUP BY o.name ORDER BY n DESC LIMIT 1
      `,
      [MIN_STAT_SEASON]
    ),
  ]);

  const bp = bestSeasonWinPct.rows[0];
  const cw = careerWins.rows[0];
  const cp = careerPoints.rows[0];
  const pa = playoffApps.rows[0];
  const ch = championships.rows[0];
  const { longestWinStreak, longestLossStreak } = await getLongestStreakRecords();

  return {
    teamGamesPlayed: Number(games.rows[0].n),
    highestSingleSeasonWinPct: bp ? { pct: Number(bp.pct), owner: bp.owner, season: bp.season } : null,
    mostCareerWins: cw ? { wins: Number(cw.wins), owner: cw.owner } : null,
    mostCareerPoints: cp ? { points: Number(cp.points), owner: cp.owner } : null,
    mostPlayoffAppearances: pa ? { count: Number(pa.n), owner: pa.owner } : null,
    mostChampionships: ch ? { count: Number(ch.n), owner: ch.owner } : null,
    longestWinStreak,
    longestLossStreak,
  };
}

// Streaks reset each season (a new season is a fresh schedule against a new
// slate of opponents), so "longest streak ever" means the longest streak
// achieved WITHIN any single season, not spanning season boundaries.
async function getLongestStreakRecords(): Promise<{
  longestWinStreak: LeagueKpis["longestWinStreak"];
  longestLossStreak: LeagueKpis["longestLossStreak"];
}> {
  const res = await pool.query(
    `
    SELECT wm.season, wm.week, o.name AS owner, oo.name AS opponent_owner, wm.points_scored AS points, wm.opponent_points
    FROM weekly_matchups wm
    JOIN owners o ON o.id = wm.owner_id
    LEFT JOIN owners oo ON oo.id = wm.opponent_owner_id
    WHERE wm.season >= $1
    ORDER BY wm.season, wm.week, o.name
  `,
    [MIN_STAT_SEASON]
  );

  const bySeason = new Map<number, WeeklyMatchupRow[]>();
  for (const r of res.rows) {
    const season = Number(r.season);
    if (!bySeason.has(season)) bySeason.set(season, []);
    bySeason.get(season)!.push({
      week: Number(r.week),
      owner: r.owner,
      opponentOwner: r.opponent_owner,
      points: Number(r.points),
      opponentPoints: Number(r.opponent_points),
    });
  }

  let bestWin: LeagueKpis["longestWinStreak"] = null;
  let bestLoss: LeagueKpis["longestLossStreak"] = null;

  for (const [season, matchups] of bySeason) {
    // buildSeasonStory needs standings too, but streak-finding doesn't touch
    // that part - pass an empty array since only the streak fields are used.
    const story = buildSeasonStory(season, matchups, []);
    if (story.longestWinStreak && (!bestWin || story.longestWinStreak.length > bestWin.length)) {
      bestWin = { length: story.longestWinStreak.length, owner: story.longestWinStreak.owner, season };
    }
    if (story.longestLossStreak && (!bestLoss || story.longestLossStreak.length > bestLoss.length)) {
      bestLoss = { length: story.longestLossStreak.length, owner: story.longestLossStreak.owner, season };
    }
  }

  return { longestWinStreak: bestWin, longestLossStreak: bestLoss };
}

export type ManagerLeaderboardRow = {
  owner: string;
  wins: number;
  losses: number;
  ties: number;
  winPct: number;
  championships: number;
  podiums: number;
  playoffAppearances: number;
  totalPoints: number;
  seasons: number;
};

export async function getManagerLeaderboard(): Promise<ManagerLeaderboardRow[]> {
  const res = await pool.query(
    `
    SELECT
      o.name AS owner,
      SUM(tbs.wins) AS wins,
      SUM(tbs.losses) AS losses,
      SUM(tbs.ties) AS ties,
      ROUND(SUM(tbs.wins)::numeric / NULLIF(SUM(tbs.wins + tbs.losses + tbs.ties), 0), 4) AS win_pct,
      SUM(CASE WHEN tbs.champion THEN 1 ELSE 0 END) AS championships,
      SUM(CASE WHEN tbs.podium THEN 1 ELSE 0 END) AS podiums,
      SUM(CASE WHEN tbs.made_playoffs THEN 1 ELSE 0 END) AS playoff_appearances,
      SUM(tbs.points_for) AS total_points,
      COUNT(*) AS seasons
    FROM teams_by_season tbs JOIN owners o ON o.id = tbs.owner_id
    WHERE tbs.season >= $1
    GROUP BY o.name
    ORDER BY win_pct DESC
  `,
    [MIN_STAT_SEASON]
  );
  return res.rows.map((r: Record<string, any>) => ({
    owner: r.owner,
    wins: Number(r.wins),
    losses: Number(r.losses),
    ties: Number(r.ties),
    winPct: Number(r.win_pct),
    championships: Number(r.championships),
    podiums: Number(r.podiums),
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

export type TopPlayer = { name: string; pos: string; fanPts: number; statsLine: string };
export type SeasonHighEntry = {
  owner: string;
  ownerId: number;
  teamName: string;
  week: number;
  points: number;
  topPlayer: TopPlayer | null;
};
export type SeasonHigh = { season: number; points: number; entries: SeasonHighEntry[] };

// Renders a player's non-empty stat categories as a compact, readable line
// (e.g. "Passing - Yds: 394, Passing - TD: 2"). Pre-2022 seasons only have
// Fan Pts/Proj Pts (no box-score detail from Yahoo), so this comes back
// empty for those years - that's an expected data limitation, not a bug.
// "Action" is a leftover column from Yahoo's roster-page add/drop button,
// not a real stat - it scrapes as blank/whitespace rather than a literal
// empty string, so it needs an explicit exclude alongside the value filter.
const NON_STAT_KEYS = new Set(["Action"]);

function formatStatsLine(stats: Record<string, string>): string {
  const parts = Object.entries(stats)
    .filter(([k, v]) => !NON_STAT_KEYS.has(k) && v && v.trim() !== "" && v.trim() !== "-" && v.trim() !== "0")
    .map(([k, v]) => `${k}: ${v.trim()}`);
  return parts.slice(0, 4).join(", ");
}

async function getTopPlayerFor(season: number, week: number, ownerId: number): Promise<TopPlayer | null> {
  const res = await pool.query(
    `SELECT player_name, pos, fan_pts, stats FROM player_weekly_stats
     WHERE season = $1 AND week = $2 AND owner_id = $3 AND is_bench = false
     ORDER BY fan_pts DESC NULLS LAST LIMIT 1`,
    [season, week, ownerId]
  );
  const row = res.rows[0];
  if (!row || row.fan_pts === null) return null;
  return {
    name: row.player_name,
    pos: row.pos,
    fanPts: Number(row.fan_pts),
    statsLine: formatStatsLine(row.stats ?? {}),
  };
}

// The single highest team-week score of each season - RANK() (not
// ROW_NUMBER()) so a tie at the top keeps every tied entry, not just one.
export async function getSeasonHighs(): Promise<SeasonHigh[]> {
  const res = await pool.query(`
    WITH ranked AS (
      SELECT wm.season, wm.week, wm.points_scored, wm.team_name, o.id AS owner_id, o.name AS owner,
        RANK() OVER (PARTITION BY wm.season ORDER BY wm.points_scored DESC) AS rnk
      FROM weekly_matchups wm JOIN owners o ON o.id = wm.owner_id
    )
    SELECT season, week, points_scored, team_name, owner_id, owner FROM ranked WHERE rnk = 1
    ORDER BY season, owner
  `);

  const topPlayers = await Promise.all(
    res.rows.map((r) => getTopPlayerFor(Number(r.season), Number(r.week), Number(r.owner_id)))
  );

  const bySeason = new Map<number, SeasonHigh>();
  res.rows.forEach((r, i) => {
    const season = Number(r.season);
    const points = Number(r.points_scored);
    if (!bySeason.has(season)) bySeason.set(season, { season, points, entries: [] });
    bySeason.get(season)!.entries.push({
      owner: r.owner,
      ownerId: Number(r.owner_id),
      teamName: r.team_name,
      week: Number(r.week),
      points,
      topPlayer: topPlayers[i],
    });
  });
  return [...bySeason.values()].sort((a, b) => a.season - b.season);
}

export type SeasonListItem = { season: number; champion: string | null };

export async function getSeasonsList(): Promise<SeasonListItem[]> {
  const res = await pool.query(`
    SELECT seasons.season, champion.name AS champion
    FROM (SELECT DISTINCT season FROM teams_by_season) seasons
    LEFT JOIN teams_by_season champion_row
      ON champion_row.season = seasons.season AND champion_row.champion = true
    LEFT JOIN owners champion ON champion.id = champion_row.owner_id
    ORDER BY seasons.season DESC
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
  const rows = await getSeasonStandings(season);
  const champion = rows.find((row) => row.champion)?.owner ?? null;
  const runnerUp = rows.find((row) => row.finalRank === 2)?.owner ?? null;
  const highest = [...rows].sort((a, b) => b.pointsFor - a.pointsFor)[0];
  const bestRecordRow = [...rows].sort((a, b) => b.wins - a.wins || b.pointsFor - a.pointsFor)[0];

  return {
    champion,
    runnerUp,
    highestScoringTeam: highest ? { owner: highest.owner, points: highest.pointsFor } : null,
    bestRecord: bestRecordRow
      ? { owner: bestRecordRow.owner, wins: bestRecordRow.wins, losses: bestRecordRow.losses, ties: bestRecordRow.ties }
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
    WITH weekly AS (
      SELECT season, owner_id,
        COUNT(*) AS games,
        SUM(CASE WHEN points_scored > opponent_points THEN 1 ELSE 0 END) AS wins,
        SUM(CASE WHEN points_scored < opponent_points THEN 1 ELSE 0 END) AS losses,
        SUM(CASE WHEN points_scored = opponent_points THEN 1 ELSE 0 END) AS ties,
        SUM(points_scored) AS points_for,
        SUM(opponent_points) AS points_against
      FROM weekly_matchups
      WHERE season = $1
      GROUP BY season, owner_id
    ), calculated AS (
      SELECT tbs.team_name, o.name AS owner, tbs.made_playoffs, tbs.champion,
        CASE WHEN weekly.games > 0 THEN weekly.wins ELSE tbs.wins END AS wins,
        CASE WHEN weekly.games > 0 THEN weekly.losses ELSE tbs.losses END AS losses,
        CASE WHEN weekly.games > 0 THEN weekly.ties ELSE tbs.ties END AS ties,
        CASE WHEN weekly.games > 0 THEN weekly.points_for ELSE tbs.points_for END AS points_for,
        CASE WHEN weekly.games > 0 THEN weekly.points_against ELSE tbs.points_against END AS points_against,
        tbs.final_rank
      FROM teams_by_season tbs
      JOIN owners o ON o.id = tbs.owner_id
      LEFT JOIN weekly ON weekly.season = tbs.season AND weekly.owner_id = tbs.owner_id
      WHERE tbs.season = $1
    )
    SELECT CASE WHEN final_rank IS NULL OR wins > 0 OR losses > 0 OR ties > 0
      THEN RANK() OVER (ORDER BY wins DESC, points_for DESC)
      ELSE final_rank END AS final_rank,
      team_name, owner, wins, losses, ties, points_for, points_against, made_playoffs, champion
    FROM calculated
    ORDER BY final_rank
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
    WHERE EXISTS (
      SELECT 1 FROM teams_by_season champion_row
      WHERE champion_row.season = tbs.season AND champion_row.champion = true
    )
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

export type WeeklyProjectionPoint = {
  week: number;
  owner: string;
  actual: number;
  projected: number | null;
  diff: number | null;
};

// Fan Pts/Proj Pts are available for every scraped season (2014-2025) even
// though the detailed box-score breakdown is 2022+ only - team-level
// projected total is the sum of each team's STARTERS' (non-bench) Proj Pts
// for that week, same exclusion used for the actual-score fingerprint match
// elsewhere in this file. A week/team with no player_weekly_stats rows (or
// all-null proj_pts) comes back with projected = null rather than a
// misleading 0.
export async function getSeasonWeeklyProjections(season: number): Promise<WeeklyProjectionPoint[]> {
  const res = await pool.query(
    `
    SELECT wm.week, o.name AS owner, wm.points_scored AS actual,
      SUM(pws.proj_pts) AS projected
    FROM weekly_matchups wm
    JOIN owners o ON o.id = wm.owner_id
    LEFT JOIN player_weekly_stats pws
      ON pws.season = wm.season AND pws.week = wm.week AND pws.owner_id = wm.owner_id AND pws.is_bench = false
    WHERE wm.season = $1
    GROUP BY wm.week, o.name, wm.points_scored
    ORDER BY wm.week, o.name
  `,
    [season]
  );
  return res.rows.map((r: Record<string, any>) => {
    const actual = Number(r.actual);
    const projected = r.projected === null ? null : Number(r.projected);
    return {
      week: Number(r.week),
      owner: r.owner,
      actual,
      projected,
      diff: projected === null ? null : Math.round((actual - projected) * 100) / 100,
    };
  });
}

export type StarterBenchPoint = {
  week: number;
  owner: string;
  starters: number;
  bench: number;
};

export type PlayerProjectionPoint = {
  week: number;
  owner: string;
  player: string;
  position: string;
  isBench: boolean;
  actual: number;
  projected: number;
  difference: number;
};

export async function getCurrentSeasonPreviewData(season: number): Promise<{
  starterBench: StarterBenchPoint[];
  playerProjections: PlayerProjectionPoint[];
}> {
  const [starterBench, playerProjections] = await Promise.all([
    pool.query(
      `
      SELECT pws.week, o.name AS owner,
        COALESCE(SUM(pws.fan_pts) FILTER (WHERE NOT pws.is_bench), 0) AS starters,
        COALESCE(SUM(pws.fan_pts) FILTER (WHERE pws.is_bench), 0) AS bench
      FROM player_weekly_stats pws
      JOIN owners o ON o.id = pws.owner_id
      WHERE pws.season = $1
      GROUP BY pws.week, o.name
      ORDER BY pws.week, starters DESC
    `,
      [season]
    ),
    pool.query(
      `
      SELECT pws.week, o.name AS owner, pws.player_name AS player, pws.pos AS position, pws.is_bench,
        pws.fan_pts AS actual, pws.proj_pts AS projected,
        pws.fan_pts - pws.proj_pts AS difference
      FROM player_weekly_stats pws
      JOIN owners o ON o.id = pws.owner_id
      WHERE pws.season = $1
        AND pws.fan_pts IS NOT NULL AND pws.proj_pts IS NOT NULL
      ORDER BY pws.week, ABS(pws.fan_pts - pws.proj_pts) DESC, pws.fan_pts DESC
    `,
      [season]
    ),
  ]);

  return {
    starterBench: starterBench.rows.map((row: Record<string, any>) => ({
      week: Number(row.week),
      owner: row.owner,
      starters: Number(row.starters),
      bench: Number(row.bench),
    })),
    playerProjections: playerProjections.rows.map((row: Record<string, any>) => ({
      week: Number(row.week),
      owner: row.owner,
      player: row.player,
      position: row.position,
      isBench: row.is_bench,
      actual: Number(row.actual),
      projected: Number(row.projected),
      difference: Number(row.difference),
    })),
  };
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

export type ManagerListEntry = { owner: string; seasons: number; championships: number; firstSeason: number };

export async function getManagersList(): Promise<ManagerListEntry[]> {
  const res = await pool.query(`
    SELECT o.name AS owner, COUNT(*) AS seasons,
      SUM(CASE WHEN tbs.champion THEN 1 ELSE 0 END) AS championships,
      MIN(tbs.season) AS first_season
    FROM owners o JOIN teams_by_season tbs ON tbs.owner_id = o.id
    GROUP BY o.name ORDER BY o.name
  `);
  return res.rows.map((r: Record<string, any>) => ({
    owner: r.owner,
    seasons: Number(r.seasons),
    championships: Number(r.championships),
    firstSeason: Number(r.first_season),
  }));
}

export type ManagerSeasonRow = {
  season: number;
  teamName: string;
  finalRank: number;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
  madePlayoffs: boolean;
  champion: boolean;
  draftOrder: number | null;
};

export type ManagerCareer = {
  wins: number;
  losses: number;
  ties: number;
  winPct: number;
  championships: number;
  playoffAppearances: number;
  totalPoints: number;
  avgPointsPerWeek: number;
  seasonsPlayed: number;
  firstSeason: number;
  lastSeason: number;
  bestFinish: number;
  worstFinish: number;
  avgFinish: number;
};

export type ManagerDetail = {
  owner: string;
  career: ManagerCareer;
  seasons: ManagerSeasonRow[];
};

// Unlike the home page's league-wide comparisons, a manager's own page is a
// single-entity view (same category as a season page) - it isn't ranking
// this owner against others, so it's NOT scoped to MIN_STAT_SEASON. Full
// career history is shown even for owners who joined after 2014.
export async function getManagerDetail(owner: string): Promise<ManagerDetail | null> {
  const res = await pool.query(
    `
    WITH weekly AS (
      SELECT season, owner_id,
        COUNT(*) AS games,
        SUM(CASE WHEN points_scored > opponent_points THEN 1 ELSE 0 END) AS wins,
        SUM(CASE WHEN points_scored < opponent_points THEN 1 ELSE 0 END) AS losses,
        SUM(CASE WHEN points_scored = opponent_points THEN 1 ELSE 0 END) AS ties,
        SUM(points_scored) AS points_for,
        SUM(opponent_points) AS points_against
      FROM weekly_matchups
      GROUP BY season, owner_id
    ), calculated AS (
      SELECT tbs.season, tbs.team_name, o.name AS owner, tbs.made_playoffs, tbs.champion, tbs.draft_order,
        CASE WHEN weekly.games > 0 THEN weekly.wins ELSE tbs.wins END AS wins,
        CASE WHEN weekly.games > 0 THEN weekly.losses ELSE tbs.losses END AS losses,
        CASE WHEN weekly.games > 0 THEN weekly.ties ELSE tbs.ties END AS ties,
        CASE WHEN weekly.games > 0 THEN weekly.points_for ELSE tbs.points_for END AS points_for,
        CASE WHEN weekly.games > 0 THEN weekly.points_against ELSE tbs.points_against END AS points_against,
        tbs.final_rank
      FROM teams_by_season tbs
      JOIN owners o ON o.id = tbs.owner_id
      LEFT JOIN weekly ON weekly.season = tbs.season AND weekly.owner_id = tbs.owner_id
    ), ranked AS (
      SELECT *,
        CASE WHEN final_rank IS NULL OR wins > 0 OR losses > 0 OR ties > 0
          THEN RANK() OVER (PARTITION BY season ORDER BY wins DESC, points_for DESC)
          ELSE final_rank END AS computed_rank
      FROM calculated
    )
    SELECT season, team_name, computed_rank AS final_rank, wins, losses, ties,
      points_for, points_against, made_playoffs, champion, draft_order
    FROM ranked
    WHERE owner = $1
    ORDER BY season
  `,
    [owner]
  );
  if (res.rows.length === 0) return null;

  const seasons: ManagerSeasonRow[] = res.rows.map((r: Record<string, any>) => ({
    season: Number(r.season),
    teamName: r.team_name,
    finalRank: Number(r.final_rank),
    wins: Number(r.wins),
    losses: Number(r.losses),
    ties: Number(r.ties),
    pointsFor: Number(r.points_for),
    pointsAgainst: Number(r.points_against),
    madePlayoffs: r.made_playoffs,
    champion: r.champion,
    draftOrder: r.draft_order === null ? null : Number(r.draft_order),
  }));

  const totalWins = seasons.reduce((s, r) => s + r.wins, 0);
  const totalLosses = seasons.reduce((s, r) => s + r.losses, 0);
  const totalTies = seasons.reduce((s, r) => s + r.ties, 0);
  const totalGames = totalWins + totalLosses + totalTies;
  const totalPoints = seasons.reduce((s, r) => s + r.pointsFor, 0);

  const gamesRes = await pool.query(
    `SELECT COUNT(*) AS n FROM weekly_matchups wm JOIN owners o ON o.id = wm.owner_id WHERE o.name = $1`,
    [owner]
  );
  const weeksPlayed = Number(gamesRes.rows[0].n);
  const ranks = seasons.map((r) => r.finalRank);

  const career: ManagerCareer = {
    wins: totalWins,
    losses: totalLosses,
    ties: totalTies,
    winPct: totalGames > 0 ? totalWins / totalGames : 0,
    championships: seasons.filter((r) => r.champion).length,
    playoffAppearances: seasons.filter((r) => r.madePlayoffs).length,
    totalPoints,
    avgPointsPerWeek: weeksPlayed > 0 ? totalPoints / weeksPlayed : 0,
    seasonsPlayed: seasons.length,
    firstSeason: seasons[0].season,
    lastSeason: seasons[seasons.length - 1].season,
    bestFinish: Math.min(...ranks),
    worstFinish: Math.max(...ranks),
    avgFinish: ranks.reduce((a, b) => a + b, 0) / ranks.length,
  };

  return { owner, career, seasons };
}

export type ManagerWinPctPoint = {
  season: number;
  managerWins: number;
  managerGames: number;
  managerWinPct: number;
  leagueAvgWinPct: number;
};

// leagueAvgWinPct is an AVG() OVER a season-wide window, computed once across
// every owner's row for that season, then filtered down to this owner's
// rows - same window-function shape as getRankTrends. Full history,
// uncapped, for the same single-entity reason as getManagerDetail.
export async function getManagerWinPctTrend(owner: string): Promise<ManagerWinPctPoint[]> {
  const res = await pool.query(`
    WITH weekly AS (
      SELECT season, owner_id,
        COUNT(*) AS games,
        SUM(CASE WHEN points_scored > opponent_points THEN 1 ELSE 0 END) AS wins,
        SUM(CASE WHEN points_scored < opponent_points THEN 1 ELSE 0 END) AS losses,
        SUM(CASE WHEN points_scored = opponent_points THEN 1 ELSE 0 END) AS ties
      FROM weekly_matchups
      GROUP BY season, owner_id
    ), calculated AS (
      SELECT tbs.season, o.name AS owner,
        CASE WHEN weekly.games > 0 THEN weekly.wins ELSE tbs.wins END AS wins,
        CASE WHEN weekly.games > 0 THEN weekly.losses ELSE tbs.losses END AS losses,
        CASE WHEN weekly.games > 0 THEN weekly.ties ELSE tbs.ties END AS ties
      FROM teams_by_season tbs
      JOIN owners o ON o.id = tbs.owner_id
      LEFT JOIN weekly ON weekly.season = tbs.season AND weekly.owner_id = tbs.owner_id
    )
    SELECT season, owner, wins, losses, ties,
      AVG(wins::numeric / NULLIF(wins + losses + ties, 0)) OVER (PARTITION BY season) AS league_avg_win_pct
    FROM calculated
    ORDER BY season
  `);
  return res.rows
    .filter((r: Record<string, any>) => r.owner === owner)
    .map((r: Record<string, any>) => {
      const wins = Number(r.wins);
      const games = wins + Number(r.losses) + Number(r.ties);
      return {
        season: Number(r.season),
        managerWins: wins,
        managerGames: games,
        managerWinPct: games > 0 ? wins / games : 0,
        leagueAvgWinPct: Number(r.league_avg_win_pct),
      };
    });
}

export type MomentumPoint = { week: number; diff: number; cumulative: number };

export async function getManagerMomentum(owner: string, season: number): Promise<MomentumPoint[]> {
  const res = await pool.query(
    `
    SELECT wm.week, wm.points_scored - wm.opponent_points AS diff
    FROM weekly_matchups wm JOIN owners o ON o.id = wm.owner_id
    WHERE o.name = $1 AND wm.season = $2
    ORDER BY wm.week
  `,
    [owner, season]
  );
  let cumulative = 0;
  return res.rows.map((r: Record<string, any>) => {
    const diff = Number(r.diff);
    cumulative += diff;
    return { week: Number(r.week), diff: Math.round(diff * 100) / 100, cumulative: Math.round(cumulative * 100) / 100 };
  });
}

export type ManagerWeekResult = {
  week: number;
  opponent: string;
  points: number;
  opponentPoints: number;
  result: "W" | "L" | "T";
  topPlayers: TopPlayer[];
};

// Same ROW_NUMBER()-per-week ranking used by getSeasonHighs' top player
// lookup, just capped at 3 instead of 1. fan_pts exists for every scraped
// season, so this works pre-2022 too - only the statsLine detail thins out
// before then (see formatStatsLine's comment).
export async function getManagerWeeklyResults(owner: string, season: number): Promise<ManagerWeekResult[]> {
  const [matchupsRes, playersRes] = await Promise.all([
    pool.query(
      `
      SELECT wm.week, oo.name AS opponent, wm.points_scored AS points, wm.opponent_points
      FROM weekly_matchups wm
      JOIN owners o ON o.id = wm.owner_id
      LEFT JOIN owners oo ON oo.id = wm.opponent_owner_id
      WHERE o.name = $1 AND wm.season = $2
      ORDER BY wm.week
    `,
      [owner, season]
    ),
    pool.query(
      `
      WITH ranked AS (
        SELECT pws.week, pws.player_name, pws.pos, pws.fan_pts, pws.stats,
          ROW_NUMBER() OVER (PARTITION BY pws.week ORDER BY pws.fan_pts DESC NULLS LAST) AS rnk
        FROM player_weekly_stats pws
        JOIN owners o ON o.id = pws.owner_id
        WHERE o.name = $1 AND pws.season = $2 AND pws.is_bench = false
      )
      SELECT week, player_name, pos, fan_pts, stats FROM ranked WHERE rnk <= 3 ORDER BY week, rnk
    `,
      [owner, season]
    ),
  ]);

  const playersByWeek = new Map<number, TopPlayer[]>();
  for (const r of playersRes.rows) {
    if (r.fan_pts === null) continue;
    const week = Number(r.week);
    if (!playersByWeek.has(week)) playersByWeek.set(week, []);
    playersByWeek.get(week)!.push({
      name: r.player_name,
      pos: r.pos,
      fanPts: Number(r.fan_pts),
      statsLine: formatStatsLine(r.stats ?? {}),
    });
  }

  return matchupsRes.rows.map((r: Record<string, any>) => {
    const points = Number(r.points);
    const opponentPoints = Number(r.opponent_points);
    const result: "W" | "L" | "T" = points > opponentPoints ? "W" : points < opponentPoints ? "L" : "T";
    return {
      week: Number(r.week),
      opponent: r.opponent ?? "—",
      points,
      opponentPoints,
      result,
      topPlayers: playersByWeek.get(Number(r.week)) ?? [],
    };
  });
}

export type TeamNameCloudEntry = { name: string; seasonsUsed: number };

// Distinct team names across ALL history (not season-capped) - this is a
// decorative visual, not a fairness-sensitive comparison stat.
export async function getTeamNameCloud(): Promise<TeamNameCloudEntry[]> {
  const res = await pool.query(`
    SELECT team_name, COUNT(*) AS seasons_used
    FROM teams_by_season
    GROUP BY team_name
    ORDER BY seasons_used DESC, team_name
  `);
  return res.rows.map((r: Record<string, any>) => ({ name: r.team_name, seasonsUsed: Number(r.seasons_used) }));
}

export type Rivalry = {
  owner: string;
  opponent: string;
  meetings: number;
  wins: number;
  losses: number;
  ties: number;
  winPct: number;
  avgMargin: number;
};

// Each owner's rivalry opponent is picked with a deterministic tiebreak
// chain: most head-to-head meetings first (frequency is what makes an
// opponent a "rival" rather than a one-off matchup), then closest all-time
// win% to 50% (an even, competitive series), then smallest average scoring
// margin (closest games), then alphabetical as a last resort so the result
// never depends on row order. The pairing is NOT guaranteed to be mutual -
// owner A's rival can be B while B's rival is someone else - that's expected
// under this definition, not a bug. Uncapped/full history, same reasoning as
// getManagerDetail: this describes a specific relationship, not a
// season-count-sensitive ranking across all owners.
export async function getRivalries(): Promise<Rivalry[]> {
  const res = await pool.query(`
    SELECT o.name AS owner, oo.name AS opponent,
      COUNT(*) AS meetings,
      SUM(CASE WHEN wm.points_scored > wm.opponent_points THEN 1 ELSE 0 END) AS wins,
      SUM(CASE WHEN wm.points_scored < wm.opponent_points THEN 1 ELSE 0 END) AS losses,
      SUM(CASE WHEN wm.points_scored = wm.opponent_points THEN 1 ELSE 0 END) AS ties,
      AVG(ABS(wm.points_scored - wm.opponent_points)) AS avg_margin
    FROM weekly_matchups wm
    JOIN owners o ON o.id = wm.owner_id
    JOIN owners oo ON oo.id = wm.opponent_owner_id
    WHERE wm.opponent_owner_id IS NOT NULL
    GROUP BY o.name, oo.name
  `);

  const byOwner = new Map<string, Record<string, any>[]>();
  for (const r of res.rows) {
    if (!byOwner.has(r.owner)) byOwner.set(r.owner, []);
    byOwner.get(r.owner)!.push(r);
  }

  const rivalries: Rivalry[] = [];
  for (const [owner, opponents] of byOwner) {
    const scored = opponents.map((o) => {
      const meetings = Number(o.meetings);
      const wins = Number(o.wins);
      const losses = Number(o.losses);
      const ties = Number(o.ties);
      return {
        opponent: o.opponent as string,
        meetings,
        wins,
        losses,
        ties,
        winPct: meetings > 0 ? (wins + ties * 0.5) / meetings : 0,
        avgMargin: Number(o.avg_margin),
      };
    });

    scored.sort((a, b) => {
      if (b.meetings !== a.meetings) return b.meetings - a.meetings;
      const closenessDiff = Math.abs(a.winPct - 0.5) - Math.abs(b.winPct - 0.5);
      if (closenessDiff !== 0) return closenessDiff;
      if (a.avgMargin !== b.avgMargin) return a.avgMargin - b.avgMargin;
      return a.opponent.localeCompare(b.opponent);
    });

    rivalries.push({ owner, ...scored[0] });
  }

  return rivalries.sort((a, b) => a.owner.localeCompare(b.owner));
}

export type PlayerNetworkOwner = { id: number; name: string };
export type PlayerSeasonPoints = { season: number; owner: string; teamName: string; points: number };
export type PlayerNetworkPlayer = {
  name: string;
  pos: string;
  totalPoints: number;
  ownerIds: number[];
  seasonBreakdown: PlayerSeasonPoints[];
};
export type PlayerNetwork = { owners: PlayerNetworkOwner[]; players: PlayerNetworkPlayer[] };

// Node set: skill-position/QB/K players (DEF excluded - defenses get streamed
// weekly and would just be waiver-wire noise) who sat on SOME roster for 10+
// weeks in a season, in at least 4 different seasons - this is what keeps the
// graph to ~190 meaningful players instead of the ~970 who ever touched a
// roster at all. Edges use the same >=10-weeks-in-a-season bar per owner, so
// a one-week waiver pickup doesn't draw a connection. `pos` in this table is
// the LINEUP SLOT for that week (a benched player shows 'BN', a flexed one
// 'W/R/T'), not a fixed real position, so a player's displayed position is
// whichever real position code (excluding those two slot values) shows up
// most often across their rows.
export async function getPlayerNetwork(): Promise<PlayerNetwork> {
  const [ownersRes, playersRes, edgesRes, seasonBreakdownRes] = await Promise.all([
    pool.query(`SELECT id, name FROM owners ORDER BY name`),
    pool.query(`
      WITH real_pos AS (
        SELECT player_name, pos,
          ROW_NUMBER() OVER (PARTITION BY player_name ORDER BY COUNT(*) DESC) AS rnk
        FROM player_weekly_stats
        WHERE position_group != 'Defense/Special Teams' AND pos NOT IN ('BN', 'W/R/T')
        GROUP BY player_name, pos
      ),
      season_presence AS (
        SELECT season, player_name, COUNT(DISTINCT week) AS weeks_rostered
        FROM player_weekly_stats
        WHERE position_group != 'Defense/Special Teams'
        GROUP BY season, player_name
      ),
      qualifying AS (
        SELECT player_name FROM season_presence WHERE weeks_rostered >= 10
        GROUP BY player_name HAVING COUNT(*) >= 4
      ),
      points AS (
        SELECT player_name, SUM(fan_pts) AS total_points
        FROM player_weekly_stats
        WHERE season BETWEEN 2018 AND 2025
        GROUP BY player_name
      )
      SELECT q.player_name, rp.pos, COALESCE(p.total_points, 0) AS total_points
      FROM qualifying q
      LEFT JOIN real_pos rp ON rp.player_name = q.player_name AND rp.rnk = 1
      LEFT JOIN points p ON p.player_name = q.player_name
    `),
    pool.query(`
      WITH season_presence AS (
        SELECT season, player_name, COUNT(DISTINCT week) AS weeks_rostered
        FROM player_weekly_stats
        WHERE position_group != 'Defense/Special Teams'
        GROUP BY season, player_name
      ),
      qualifying AS (
        SELECT player_name FROM season_presence WHERE weeks_rostered >= 10
        GROUP BY player_name HAVING COUNT(*) >= 4
      ),
      owner_season_presence AS (
        SELECT season, owner_id, player_name, COUNT(DISTINCT week) AS weeks_rostered
        FROM player_weekly_stats
        WHERE position_group != 'Defense/Special Teams'
        GROUP BY season, owner_id, player_name
      )
      SELECT DISTINCT owner_id, player_name
      FROM owner_season_presence
      WHERE weeks_rostered >= 10 AND player_name IN (SELECT player_name FROM qualifying)
    `),
    // Per-season point total behind the node's "total points, 2018-2025"
    // figure - grouped by (season, owner) rather than just season, so a
    // mid-season trade shows as two separate rows instead of merging into
    // one owner's line.
    pool.query(`
      WITH season_presence AS (
        SELECT season, player_name, COUNT(DISTINCT week) AS weeks_rostered
        FROM player_weekly_stats
        WHERE position_group != 'Defense/Special Teams'
        GROUP BY season, player_name
      ),
      qualifying AS (
        SELECT player_name FROM season_presence WHERE weeks_rostered >= 10
        GROUP BY player_name HAVING COUNT(*) >= 4
      )
      SELECT pws.player_name, pws.season, o.name AS owner, tbs.team_name, SUM(pws.fan_pts) AS points
      FROM player_weekly_stats pws
      JOIN owners o ON o.id = pws.owner_id
      LEFT JOIN teams_by_season tbs ON tbs.season = pws.season AND tbs.owner_id = pws.owner_id
      WHERE pws.season BETWEEN 2018 AND 2025 AND pws.player_name IN (SELECT player_name FROM qualifying)
      GROUP BY pws.player_name, pws.season, o.name, tbs.team_name
      ORDER BY pws.player_name, pws.season, o.name
    `),
  ]);

  const ownerIdsByPlayer = new Map<string, number[]>();
  for (const r of edgesRes.rows) {
    const name = r.player_name as string;
    if (!ownerIdsByPlayer.has(name)) ownerIdsByPlayer.set(name, []);
    ownerIdsByPlayer.get(name)!.push(Number(r.owner_id));
  }

  const seasonBreakdownByPlayer = new Map<string, PlayerSeasonPoints[]>();
  for (const r of seasonBreakdownRes.rows) {
    const name = r.player_name as string;
    if (!seasonBreakdownByPlayer.has(name)) seasonBreakdownByPlayer.set(name, []);
    seasonBreakdownByPlayer.get(name)!.push({
      season: Number(r.season),
      owner: r.owner,
      teamName: r.team_name ?? "—",
      points: Number(r.points),
    });
  }

  // A player can clear the qualifying bar (10+ weeks rostered in a season,
  // 4+ such seasons) via weeks split across MULTIPLE owners in the same
  // season, without any single owner individually reaching 10 - that leaves
  // zero edges for them here (edges require one owner to hit the bar alone).
  // A node with no edges has nothing pulling it toward the graph, so it gets
  // flung out by the force simulation's repulsion instead of just rendering
  // as an isolated dot - drop them rather than show a broken node.
  const players: PlayerNetworkPlayer[] = playersRes.rows
    .map((r: Record<string, any>) => ({
      name: r.player_name,
      pos: r.pos ?? "—",
      totalPoints: Number(r.total_points),
      ownerIds: ownerIdsByPlayer.get(r.player_name) ?? [],
      seasonBreakdown: seasonBreakdownByPlayer.get(r.player_name) ?? [],
    }))
    .filter((p) => p.ownerIds.length > 0);

  return {
    owners: ownersRes.rows.map((r: Record<string, any>) => ({ id: Number(r.id), name: r.name })),
    players,
  };
}
