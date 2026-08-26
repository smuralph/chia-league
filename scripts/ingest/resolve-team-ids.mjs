// Yahoo's team_id (used in scrape URLs, e.g. .../f1/561841/11/team...) has no
// direct link to a team name anywhere in the scraped pages we kept. But a
// team's weekly total is just the sum of its starters' (non-bench) Fan Pts,
// and that total is also recorded in weekly_detail.txt keyed by team name.
// So: compute each scraped team_id's starter-point total for a week, and
// find the weekly_detail.txt row in that season+week with a matching total.
// Checked across multiple weeks per team_id to rule out coincidental ties.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { parseTsv } from "./shared.mjs";
import { pool } from "./db.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..", "..");
const SCRAPE_OUTPUT = path.join(REPO_ROOT, "scripts", "yahoo-scrape", "output");
const EPSILON = 0.02;

function starterTotal(weekJson) {
  let total = 0;
  for (const table of weekJson.tables) {
    for (const row of table.rows) {
      if (row.Pos === "BN") continue;
      const fanPts = parseFloat(row["Fantasy - Fan Pts"]);
      if (!Number.isNaN(fanPts)) total += fanPts;
    }
  }
  return Math.round(total * 100) / 100;
}

function loadWeeklyDetail() {
  const rows = parseTsv(path.join(REPO_ROOT, "historical_data_chias_weekly_detail.txt"));
  const byKey = new Map(); // "season_week" -> [{owner, team_name, points_scored}]
  for (const row of rows) {
    const week = Number(row.Week.replace("Week ", ""));
    const key = `${row.Season}_${week}`;
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push({
      owner: row.Owner,
      team_name: row["Team Name"],
      points_scored: Math.round(parseFloat(row.Points_Scored) * 100) / 100,
    });
  }
  return byKey;
}

async function main() {
  const weeklyByKey = loadWeeklyDetail();
  const seasons = fs.readdirSync(SCRAPE_OUTPUT).filter((s) => /^\d{4}$/.test(s));

  const resolved = [];
  const unresolved = [];

  for (const season of seasons) {
    const seasonDir = path.join(SCRAPE_OUTPUT, season);
    const teamIds = fs.readdirSync(seasonDir);

    for (const teamId of teamIds) {
      const teamDir = path.join(seasonDir, teamId);
      const weekFiles = fs
        .readdirSync(teamDir)
        .filter((f) => f.startsWith("week-"))
        .sort((a, b) => Number(a.match(/\d+/)[0]) - Number(b.match(/\d+/)[0]));

      let candidate = null;
      let leagueId = null;
      let agreementCount = 0;

      for (const weekFile of weekFiles.slice(0, 5)) {
        const weekNum = Number(weekFile.match(/\d+/)[0]);
        const data = JSON.parse(fs.readFileSync(path.join(teamDir, weekFile), "utf8"));
        leagueId = data.league_id;
        const total = starterTotal(data);
        const options = weeklyByKey.get(`${season}_${weekNum}`) || [];
        const matches = options.filter((o) => Math.abs(o.points_scored - total) < EPSILON);

        if (matches.length === 1) {
          if (candidate === null) {
            candidate = matches[0];
            agreementCount = 1;
          } else if (candidate.team_name === matches[0].team_name) {
            agreementCount++;
          } else {
            candidate = null; // conflicting matches across weeks - bail
            break;
          }
        }
        if (agreementCount >= 2) break; // two independent weeks agree, good enough
      }

      if (candidate && agreementCount >= 1) {
        resolved.push({ season: Number(season), league_id: leagueId, yahoo_team_id: Number(teamId), ...candidate });
      } else {
        unresolved.push({ season, teamId });
      }
    }
  }

  console.log(`Resolved: ${resolved.length}, unresolved: ${unresolved.length}`);
  if (unresolved.length) {
    console.log("Unresolved team_ids (need manual review):");
    for (const u of unresolved) console.log(`  ${u.season}/${u.teamId}`);
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    for (const r of resolved) {
      const ownerRes = await client.query(
        `INSERT INTO owners (name) VALUES ($1) ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name RETURNING id`,
        [r.owner]
      );
      const ownerId = ownerRes.rows[0].id;
      await client.query(
        `INSERT INTO team_yahoo_ids (season, league_id, yahoo_team_id, owner_id, team_name)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (season, yahoo_team_id) DO UPDATE SET owner_id = EXCLUDED.owner_id, team_name = EXCLUDED.team_name`,
        [r.season, r.league_id, r.yahoo_team_id, ownerId, r.team_name]
      );
    }
    await client.query("COMMIT");
    console.log(`Wrote ${resolved.length} team_yahoo_ids rows.`);
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
