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
    SELECT tbs.season, tbs.team_name, tbs.final_rank, tbs.wins, tbs.losses, tbs.ties,
      tbs.points_for, tbs.points_against, tbs.made_playoffs, tbs.champion, tbs.draft_order
    FROM teams_by_season tbs JOIN owners o ON o.id = tbs.owner_id
    WHERE o.name = $1
    ORDER BY tbs.season
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
    SELECT tbs.season, o.name AS owner, tbs.wins, tbs.losses, tbs.ties,
      AVG(tbs.wins::numeric / NULLIF(tbs.wins + tbs.losses + tbs.ties, 0)) OVER (PARTITION BY tbs.season) AS league_avg_win_pct
    FROM teams_by_season tbs JOIN owners o ON o.id = tbs.owner_id
    ORDER BY tbs.season
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
