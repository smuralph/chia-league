import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./db.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CURRENT_SEASON_DIR = path.join(__dirname, "..", "current-season");

function extractMatchupScores(payload, week) {
  const text = (payload.rawHtmlSnippet || "").replace(/\s+/g, " ").replace(/\u00a0/g, " ");
  const match = text.match(
    new RegExp(`Week\\s+${week}\\s+vs\\s+.+?\\s+•\\s+\\d+(?:st|nd|rd|th)\\s+(\\d+(?:\\.\\d+)?)\\s+(\\d+(?:\\.\\d+)?)\\s+vs\\s+(\\d+(?:\\.\\d+)?)\\s+(\\d+(?:\\.\\d+)?)`, "i")
  );
  if (!match) throw new Error(`Could not parse Week ${week} matchup scores for Yahoo team ${payload.teamId}.`);
  return {
    actual: Number(match[1]),
    projected: Number(match[2]),
  };
}

async function main() {
  const config = JSON.parse(fs.readFileSync(path.join(CURRENT_SEASON_DIR, "config.json"), "utf8"));
  const season = Number(config.season);
  const throughWeek = Number(process.argv[2] || config.currentWeek);
  const client = await pool.connect();
  let updated = 0;

  try {
    await client.query("BEGIN");
    await client.query("ALTER TABLE weekly_matchups ADD COLUMN IF NOT EXISTS projected_points NUMERIC");

    for (let week = 1; week <= throughWeek; week += 1) {
      for (const team of config.teams) {
        const payloadPath = path.join(CURRENT_SEASON_DIR, "output", String(season), `week-${week}`, `team-${team.teamId}.json`);
        const payload = JSON.parse(fs.readFileSync(payloadPath, "utf8"));
        const scores = extractMatchupScores(payload, week);
        const stored = await client.query(
          `SELECT wm.points_scored
           FROM weekly_matchups wm
           JOIN team_yahoo_ids ty ON ty.season = wm.season AND ty.owner_id = wm.owner_id
           WHERE wm.season = $1 AND wm.week = $2 AND ty.yahoo_team_id = $3`,
          [season, week, Number(team.teamId)]
        );

        if (stored.rowCount !== 1 || Math.abs(Number(stored.rows[0].points_scored) - scores.actual) > 0.01) {
          throw new Error(`Stored Week ${week} final score does not match Yahoo team ${team.teamId}; transaction aborted.`);
        }

        await client.query(
          `UPDATE weekly_matchups wm
           SET projected_points = $1
           FROM team_yahoo_ids ty
           WHERE wm.season = $2 AND wm.week = $3 AND ty.season = wm.season
             AND ty.owner_id = wm.owner_id AND ty.yahoo_team_id = $4`,
          [scores.projected, season, week, Number(team.teamId)]
        );
        updated += 1;
      }
    }

    await client.query("COMMIT");
    console.log(`Updated team-level projections for ${updated} matchups; final scores and player rows were not changed.`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Projection backfill failed:", error);
  process.exit(1);
});