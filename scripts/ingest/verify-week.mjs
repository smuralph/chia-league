// verify-week.mjs - post-ingestion checks for a season week.
// Usage: node scripts/ingest/verify-week.mjs 6
import { pool } from "./db.mjs";

const season = 2026;
const week = Number(process.argv[2]);
if (!Number.isInteger(week) || week < 1 || week > 18) {
  console.error("Usage: node scripts/ingest/verify-week.mjs <week 1-18>");
  process.exit(1);
}

const perWeek = await pool.query(
  "SELECT week, COUNT(*) AS matchups FROM weekly_matchups WHERE season = $1 GROUP BY week ORDER BY week",
  [season]
);
console.log("Matchups per week:", perWeek.rows.map((r) => `w${r.week}=${r.matchups}`).join(" "));

const players = await pool.query(
  "SELECT COUNT(*)::int AS rows FROM player_weekly_stats WHERE season = $1 AND week = $2",
  [season, week]
);
console.log(`Week ${week} player rows: ${players.rows[0].rows}`);

const recon = await pool.query(
  `SELECT w.team_name, w.points_scored, w.opponent_team_name, w.opponent_points,
          o.points_scored AS opponent_confirms,
          w.opponent_points = o.points_scored AS pair_reconciles
   FROM weekly_matchups w
   JOIN weekly_matchups o
     ON o.season = w.season AND o.week = w.week AND o.owner_id = w.opponent_owner_id
   WHERE w.season = $1 AND w.week = $2
   ORDER BY w.points_scored DESC`,
  [season, week]
);
console.table(recon.rows);
const bad = recon.rows.filter((r) => !r.pair_reconciles).length;
const unpaired = await pool.query(
  "SELECT COUNT(*)::int AS n FROM weekly_matchups WHERE season = $1 AND week = $2 AND opponent_owner_id IS NULL",
  [season, week]
);

if (recon.rows.length !== 12 || bad > 0 || unpaired.rows[0].n > 0) {
  console.error(`Week ${week} verification FAILED: ${recon.rows.length}/12 rows, ${bad} unreconciled pairs, ${unpaired.rows[0].n} unpaired.`);
  await pool.end();
  process.exit(1);
}

console.log(`Week ${week} verified: 12 matchups, all 6 pairs reconcile.`);
await pool.end();
