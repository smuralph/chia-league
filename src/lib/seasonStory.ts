import type { WeeklyMatchupRow, SeasonStandingsRow } from "./queries";

type Result = "W" | "L" | "T";

type WeekRecord = {
  week: number;
  owner: string;
  opponentOwner: string;
  points: number;
  opponentPoints: number;
  result: Result;
  cumWinsBefore: number;
  cumLossesBefore: number;
  cumTiesBefore: number;
  cumWinsAfter: number;
  cumLossesAfter: number;
  cumPointsAfter: number;
};

function resultOf(points: number, opponentPoints: number): Result {
  if (points > opponentPoints) return "W";
  if (points < opponentPoints) return "L";
  return "T";
}

// Builds, per owner, their week-by-week results with running win/loss/tie
// totals both entering (before) and leaving (after) each week - the
// foundation every other stat in this file is derived from.
function buildWeekRecords(matchups: WeeklyMatchupRow[]): WeekRecord[] {
  const byOwner = new Map<string, WeeklyMatchupRow[]>();
  for (const row of matchups) {
    if (!byOwner.has(row.owner)) byOwner.set(row.owner, []);
    byOwner.get(row.owner)!.push(row);
  }

  const records: WeekRecord[] = [];
  for (const [owner, rows] of byOwner) {
    rows.sort((a, b) => a.week - b.week);
    let w = 0,
      l = 0,
      t = 0,
      pts = 0;
    for (const row of rows) {
      const result = resultOf(row.points, row.opponentPoints);
      const before = { w, l, t };
      if (result === "W") w++;
      else if (result === "L") l++;
      else t++;
      pts += row.points;
      records.push({
        week: row.week,
        owner,
        opponentOwner: row.opponentOwner,
        points: row.points,
        opponentPoints: row.opponentPoints,
        result,
        cumWinsBefore: before.w,
        cumLossesBefore: before.l,
        cumTiesBefore: before.t,
        cumWinsAfter: w,
        cumLossesAfter: l,
        cumPointsAfter: pts,
      });
    }
  }
  return records;
}

function winPct(w: number, l: number, t: number): number | null {
  const games = w + l + t;
  return games === 0 ? null : w / games;
}

export type Blowout = { week: number; winner: string; loser: string; margin: number; winnerPoints: number; loserPoints: number };

function dedupedMatchups(records: WeekRecord[]): WeekRecord[] {
  // Every real matchup appears twice (once per side) - keep one, preferring
  // a stable, deterministic pick (alphabetically-first owner's row).
  const seen = new Set<string>();
  const out: WeekRecord[] = [];
  for (const r of records) {
    const key = [r.week, [r.owner, r.opponentOwner].sort().join("|")].join("::");
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(r);
  }
  return out;
}

export function getBiggestBlowout(records: WeekRecord[]): Blowout | null {
  const deduped = dedupedMatchups(records);
  let best: Blowout | null = null;
  for (const r of deduped) {
    const margin = Math.abs(r.points - r.opponentPoints);
    if (!best || margin > best.margin) {
      const winnerIsOwner = r.points > r.opponentPoints;
      best = {
        week: r.week,
        winner: winnerIsOwner ? r.owner : r.opponentOwner,
        loser: winnerIsOwner ? r.opponentOwner : r.owner,
        winnerPoints: winnerIsOwner ? r.points : r.opponentPoints,
        loserPoints: winnerIsOwner ? r.opponentPoints : r.points,
        margin,
      };
    }
  }
  return best;
}

export function getClosestGame(records: WeekRecord[]): Blowout | null {
  const deduped = dedupedMatchups(records).filter((r) => r.result !== "T");
  let best: Blowout | null = null;
  for (const r of deduped) {
    const margin = Math.abs(r.points - r.opponentPoints);
    if (!best || margin < best.margin) {
      const winnerIsOwner = r.points > r.opponentPoints;
      best = {
        week: r.week,
        winner: winnerIsOwner ? r.owner : r.opponentOwner,
        loser: winnerIsOwner ? r.opponentOwner : r.owner,
        winnerPoints: winnerIsOwner ? r.points : r.opponentPoints,
        loserPoints: winnerIsOwner ? r.opponentPoints : r.points,
        margin,
      };
    }
  }
  return best;
}

export type Streak = { owner: string; length: number; startWeek: number; endWeek: number };

function longestStreak(records: WeekRecord[], owner: string, forResult: "W" | "L"): Streak | null {
  const rows = records.filter((r) => r.owner === owner).sort((a, b) => a.week - b.week);
  let best: Streak | null = null;
  let current: { length: number; startWeek: number } | null = null;
  for (const row of rows) {
    if (row.result === forResult) {
      if (!current) current = { length: 1, startWeek: row.week };
      else current.length++;
      if (!best || current.length > best.length) {
        best = { owner, length: current.length, startWeek: current.startWeek, endWeek: row.week };
      }
    } else {
      current = null;
    }
  }
  return best;
}

export function getLongestStreaks(records: WeekRecord[], owners: string[]) {
  let bestWin: Streak | null = null;
  let bestLoss: Streak | null = null;
  for (const owner of owners) {
    const w = longestStreak(records, owner, "W");
    const l = longestStreak(records, owner, "L");
    if (w && (!bestWin || w.length > bestWin.length)) bestWin = w;
    if (l && (!bestLoss || l.length > bestLoss.length)) bestLoss = l;
  }
  return { longestWinStreak: bestWin, longestLossStreak: bestLoss };
}

export type Upset = {
  week: number;
  winner: string;
  loser: string;
  winnerEnteringWinPct: number;
  loserEnteringWinPct: number;
  gap: number;
};

// "Upset" = the winner had a worse entering (that week's starting) win% than
// the loser. Week 1 has no entering record for anyone, so it's excluded.
// Resolves entering win% for both sides of every matchup using a full
// owner+week -> record lookup (needed since a deduped row only carries one
// side's before-state).
export function resolveUpsets(records: WeekRecord[], limit = 3): Upset[] {
  const byOwnerWeek = new Map<string, WeekRecord>();
  for (const r of records) byOwnerWeek.set(`${r.owner}|${r.week}`, r);

  const deduped = dedupedMatchups(records).filter((r) => r.week > 1 && r.result !== "T");
  const upsets: Upset[] = [];

  for (const r of deduped) {
    const opponentRecord = byOwnerWeek.get(`${r.opponentOwner}|${r.week}`);
    if (!opponentRecord) continue;

    const ownerPct = winPct(r.cumWinsBefore, r.cumLossesBefore, r.cumTiesBefore);
    const oppPct = winPct(opponentRecord.cumWinsBefore, opponentRecord.cumLossesBefore, opponentRecord.cumTiesBefore);
    if (ownerPct === null || oppPct === null) continue;

    const ownerWon = r.points > r.opponentPoints;
    const winnerPct = ownerWon ? ownerPct : oppPct;
    const loserPct = ownerWon ? oppPct : ownerPct;
    if (winnerPct >= loserPct) continue; // not an upset

    upsets.push({
      week: r.week,
      winner: ownerWon ? r.owner : r.opponentOwner,
      loser: ownerWon ? r.opponentOwner : r.owner,
      winnerEnteringWinPct: winnerPct,
      loserEnteringWinPct: loserPct,
      gap: loserPct - winnerPct,
    });
  }

  return upsets.sort((a, b) => b.gap - a.gap).slice(0, limit);
}

export type StandingsSwing = {
  owner: string;
  midpointRank: number;
  finalRank: number;
  madePlayoffsFinal: boolean;
  type: "comeback" | "collapse";
};

// Comeback = outside the playoff cutoff at the season's midpoint but made
// the playoffs anyway. Collapse = the reverse. Only returns swings that
// actually crossed the cutoff line, sorted by how dramatic the rank move was.
export function getStandingsSwings(records: WeekRecord[], standings: SeasonStandingsRow[]): StandingsSwing[] {
  const maxWeek = Math.max(...records.map((r) => r.week));
  const midpoint = Math.ceil(maxWeek / 2);
  const playoffSpots = standings.filter((s) => s.madePlayoffs).length;
  if (playoffSpots === 0) return [];

  const owners = [...new Set(records.map((r) => r.owner))];
  const midpointTotals = owners.map((owner) => {
    const rows = records.filter((r) => r.owner === owner && r.week <= midpoint);
    const w = rows.filter((r) => r.result === "W").length;
    const l = rows.filter((r) => r.result === "L").length;
    const t = rows.filter((r) => r.result === "T").length;
    const pts = rows.reduce((sum, r) => sum + r.points, 0);
    return { owner, w, l, t, pts };
  });

  midpointTotals.sort((a, b) => b.w - a.w || b.pts - a.pts);
  const midpointRankByOwner = new Map<string, number>();
  midpointTotals.forEach((row, i) => midpointRankByOwner.set(row.owner, i + 1));

  const swings: StandingsSwing[] = [];
  for (const s of standings) {
    const midRank = midpointRankByOwner.get(s.owner);
    if (midRank === undefined) continue;
    const wasInPosition = midRank <= playoffSpots;
    if (!wasInPosition && s.madePlayoffs) {
      swings.push({ owner: s.owner, midpointRank: midRank, finalRank: s.finalRank, madePlayoffsFinal: true, type: "comeback" });
    } else if (wasInPosition && !s.madePlayoffs) {
      swings.push({ owner: s.owner, midpointRank: midRank, finalRank: s.finalRank, madePlayoffsFinal: false, type: "collapse" });
    }
  }

  return swings.sort((a, b) => Math.abs(b.midpointRank - b.finalRank) - Math.abs(a.midpointRank - a.finalRank));
}

export type SeasonStory = {
  headline: string;
  biggestBlowout: Blowout | null;
  closestGame: Blowout | null;
  longestWinStreak: Streak | null;
  longestLossStreak: Streak | null;
  biggestUpsets: Upset[];
  biggestComeback: StandingsSwing | null;
  biggestCollapse: StandingsSwing | null;
};

export function buildSeasonStory(
  season: number,
  matchups: WeeklyMatchupRow[],
  standings: SeasonStandingsRow[]
): SeasonStory {
  const records = buildWeekRecords(matchups);
  const owners = [...new Set(matchups.map((m) => m.owner))];

  const biggestBlowout = getBiggestBlowout(records);
  const closestGame = getClosestGame(records);
  const { longestWinStreak, longestLossStreak } = getLongestStreaks(records, owners);
  const biggestUpsets = resolveUpsets(records, 3);
  const swings = getStandingsSwings(records, standings);
  const biggestComeback = swings.find((s) => s.type === "comeback") ?? null;
  const biggestCollapse = swings.find((s) => s.type === "collapse") ?? null;

  const champion = standings.find((s) => s.champion);
  const latestWeek = matchups.length ? Math.max(...matchups.map((matchup) => matchup.week)) : null;
  let headline = champion
    ? `${champion.owner} claimed the ${season} title, finishing ${champion.wins}-${champion.losses}${champion.ties ? `-${champion.ties}` : ""}.`
    : latestWeek
      ? `The ${season} season is in the books through Week ${latestWeek}.`
      : `The ${season} season is in the books.`;

  if (biggestCollapse) {
    headline += ` ${biggestCollapse.owner} looked playoff-bound at the midpoint (rank ${biggestCollapse.midpointRank}) but collapsed to finish ${biggestCollapse.finalRank}th.`;
  } else if (biggestComeback) {
    headline += ` ${biggestComeback.owner} was outside the playoff picture at the midpoint (rank ${biggestComeback.midpointRank}) but surged to finish ${biggestComeback.finalRank}${biggestComeback.finalRank === 1 ? "st" : biggestComeback.finalRank === 2 ? "nd" : biggestComeback.finalRank === 3 ? "rd" : "th"}.`;
  }

  return {
    headline,
    biggestBlowout,
    closestGame,
    longestWinStreak,
    longestLossStreak,
    biggestUpsets,
    biggestComeback,
    biggestCollapse,
  };
}
