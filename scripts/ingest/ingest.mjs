import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseTsv } from "./shared.mjs";
import { pool } from "./db.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..", "..");

const YN = (v) => v === "Y";
const num = (v) => (v === "" || v === undefined ? null : Number(v));

async function upsertOwner(client, name) {
  const res = await client.query(
    `INSERT INTO owners (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
    [name]
  );
  return res.rows[0].id;
}

async function ingestSeasonSummary(client) {
  const rows = parseTsv(path.join(REPO_ROOT, "historical_data_chias_season summary.txt"));
  let count = 0;
  for (const row of rows) {
    const ownerId = await upsertOwner(client, row.Owner);
    await client.query(
      `INSERT INTO teams_by_season
        (season, owner_id, team_name, since_year, final_rank, wins, losses, ties,
         points_for, points_against, made_playoffs, moves, champion, podium, draft_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
       ON CONFLICT (season, owner_id) DO UPDATE SET
         team_name = EXCLUDED.team_name, since_year = EXCLUDED.since_year,
         final_rank = EXCLUDED.final_rank, wins = EXCLUDED.wins, losses = EXCLUDED.losses,
         ties = EXCLUDED.ties, points_for = EXCLUDED.points_for,
         points_against = EXCLUDED.points_against, made_playoffs = EXCLUDED.made_playoffs,
         moves = EXCLUDED.moves, champion = EXCLUDED.champion, podium = EXCLUDED.podium,
         draft_order = EXCLUDED.draft_order`,
      [
        num(row.Season),
        ownerId,
        row["Team Name"],
        num(row["Since Year"]),
        num(row["Final Rank"]),
        num(row.Wins),
        num(row.Losses),
        num(row.Ties) ?? 0,
        num(row["Points For"]),
        num(row["Points Against"]),
        YN(row["Made Playoffs"]),
        num(row.Moves),
        YN(row.champion),
        YN(row.podium),
        num(row["Draft Order"]),
      ]
    );
    count++;
  }
  return count;
}

async function ingestWeeklyMatchups(client) {
  const rows = parseTsv(path.join(REPO_ROOT, "historical_data_chias_weekly_detail.txt"));
  const ownerIdByName = new Map();
  const getOwnerId = async (name) => {
    if (!ownerIdByName.has(name)) ownerIdByName.set(name, await upsertOwner(client, name));
    return ownerIdByName.get(name);
  };

  // Opponent rows only give the opponent's team name, not owner - build a
  // (season, team_name) -> owner lookup from this same file first.
  const ownerByTeamInSeason = new Map();
  for (const row of rows) {
    ownerByTeamInSeason.set(`${row.Season}|${row["Team Name"]}`, row.Owner);
  }

  let count = 0;
  for (const row of rows) {
    const week = Number(row.Week.replace("Week ", ""));
    const ownerId = await getOwnerId(row.Owner);
    const opponentOwnerName = ownerByTeamInSeason.get(`${row.Season}|${row.Opponent}`);
    const opponentOwnerId = opponentOwnerName ? await getOwnerId(opponentOwnerName) : null;

    await client.query(
      `INSERT INTO weekly_matchups
        (season, week, owner_id, team_name, points_scored, opponent_owner_id, opponent_team_name, opponent_points)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       ON CONFLICT (season, week, owner_id) DO UPDATE SET
         team_name = EXCLUDED.team_name, points_scored = EXCLUDED.points_scored,
         opponent_owner_id = EXCLUDED.opponent_owner_id, opponent_team_name = EXCLUDED.opponent_team_name,
         opponent_points = EXCLUDED.opponent_points`,
      [
        num(row.Season),
        week,
        ownerId,
        row["Team Name"],
        num(row.Points_Scored),
        opponentOwnerId,
        row.Opponent,
        num(row.Opponent_Points),
      ]
    );
    count++;
  }
  return count;
}

async function main() {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const summaryCount = await ingestSeasonSummary(client);
    const weeklyCount = await ingestWeeklyMatchups(client);
    await client.query("COMMIT");
    console.log(`Ingested ${summaryCount} teams_by_season rows, ${weeklyCount} weekly_matchups rows.`);
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
