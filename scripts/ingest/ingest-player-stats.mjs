import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./db.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..", "..");
const SCRAPE_OUTPUT = path.join(REPO_ROOT, "scripts", "yahoo-scrape", "output");

async function loadTeamOwnerMap(client) {
  const res = await client.query(`SELECT season, yahoo_team_id, owner_id FROM team_yahoo_ids`);
  const map = new Map();
  for (const row of res.rows) map.set(`${row.season}|${row.yahoo_team_id}`, row.owner_id);
  return map;
}

function extractPlayerRows(weekJson) {
  const rows = [];
  for (const table of weekJson.tables) {
    for (const row of table.rows) {
      const { Pos, Bye, "Fantasy - Fan Pts": fanPts, "Fantasy - Proj Pts": projPts, ...rest } = row;
      const playerName = row[table.sectionLabel]; // "Offense" | "Kickers" | "Defense/Special Teams" column holds the name
      const stats = { ...rest };
      delete stats[table.sectionLabel];
      const toNum = (v) => {
        if (v === undefined || v === "-" || v === "") return null;
        const n = Number(v);
        return Number.isNaN(n) ? null : n;
      };
      rows.push({
        position_group: table.sectionLabel,
        pos: Pos,
        player_name: playerName,
        is_bench: Pos === "BN",
        bye: toNum(Bye),
        fan_pts: toNum(fanPts),
        proj_pts: toNum(projPts),
        stats,
      });
    }
  }
  return rows;
}

const COLUMNS = ["season", "week", "owner_id", "position_group", "pos", "player_name", "is_bench", "bye", "fan_pts", "proj_pts", "stats"];
const BATCH_SIZE = 1000; // 11 params/row * 1000 = 11000 params, well under Postgres' 65535 limit

async function insertBatch(client, rows) {
  if (rows.length === 0) return;
  const valueTuples = [];
  const params = [];
  rows.forEach((row, i) => {
    const base = i * COLUMNS.length;
    valueTuples.push(`(${COLUMNS.map((_, j) => `$${base + j + 1}`).join(",")})`);
    params.push(
      row.season,
      row.week,
      row.owner_id,
      row.position_group,
      row.pos,
      row.player_name,
      row.is_bench,
      row.bye,
      row.fan_pts,
      row.proj_pts,
      JSON.stringify(row.stats)
    );
  });
  await client.query(
    `INSERT INTO player_weekly_stats (${COLUMNS.join(",")}) VALUES ${valueTuples.join(",")}`,
    params
  );
}

async function main() {
  const client = await pool.connect();
  const teamOwnerMap = await loadTeamOwnerMap(client);

  let skippedNoOwner = 0;
  const skippedTeams = new Set();
  const pending = [];
  let totalInserted = 0;

  async function flush() {
    if (pending.length === 0) return;
    await insertBatch(client, pending.splice(0, pending.length));
  }

  const seasons = fs.readdirSync(SCRAPE_OUTPUT).filter((s) => /^\d{4}$/.test(s));
  for (const season of seasons) {
    const seasonDir = path.join(SCRAPE_OUTPUT, season);
    const teamIds = fs.readdirSync(seasonDir);

    for (const teamId of teamIds) {
      const ownerId = teamOwnerMap.get(`${season}|${teamId}`);
      if (!ownerId) {
        skippedNoOwner++;
        skippedTeams.add(`${season}/${teamId}`);
        continue;
      }

      const teamDir = path.join(seasonDir, teamId);
      const weekFiles = fs.readdirSync(teamDir).filter((f) => f.startsWith("week-"));

      for (const weekFile of weekFiles) {
        const weekNum = Number(weekFile.match(/\d+/)[0]);
        const data = JSON.parse(fs.readFileSync(path.join(teamDir, weekFile), "utf8"));
        const playerRows = extractPlayerRows(data);

        for (const p of playerRows) {
          pending.push({ season: Number(season), week: weekNum, owner_id: ownerId, ...p });
          totalInserted++;
        }
      }

      if (pending.length >= BATCH_SIZE) await flush();
    }
    await flush();
    console.log(`  season ${season} done (${totalInserted} rows queued so far)`);
  }
  await flush();

  console.log(`\nInserted ${totalInserted} player_weekly_stats rows.`);
  console.log(`Skipped ${skippedNoOwner} team-weeks with no resolved owner (departed managers): ${[...skippedTeams].join(", ")}`);

  client.release();
  await pool.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
