import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./db.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, "..", "..");
const CURRENT_SEASON_DIR = path.join(REPO_ROOT, "scripts", "current-season");

function loadConfig() {
  return JSON.parse(fs.readFileSync(path.join(CURRENT_SEASON_DIR, "config.json"), "utf8"));
}

function toNumber(value) {
  if (value === undefined || value === null || value === "" || value === "-") return null;
  const number = Number(value);
  return Number.isNaN(number) ? null : number;
}

function extractOpponentTeamName(payload) {
  const match = (payload.rawHtmlSnippet || "").match(/Week\s+\d+\s+vs\s+(.+?)\s+•/i);
  return match ? match[1].trim() : null;
}

function extractPlayerRows(payload) {
  return (payload.roster || []).flatMap((table) => table.rows.map((row) => {
    const position = row.Pos || null;
    const fanPoints = row["Fantasy - Fan Pts"] ?? row["Fan Pts"];
    const projectedPoints = row["Fantasy - Proj Pts"] ?? row["Proj Pts"];
    const stats = { ...row };
    delete stats.Pos;
    delete stats.Bye;
    delete stats["Fantasy - Fan Pts"];
    delete stats["Fantasy - Proj Pts"];
    delete stats["Fan Pts"];
    delete stats["Proj Pts"];
    delete stats[table.sectionLabel];

    return {
      positionGroup: table.sectionLabel,
      pos: position,
      playerName: row[table.sectionLabel] || null,
      isBench: position === "BN",
      bye: toNumber(row.Bye),
      fanPoints: toNumber(fanPoints),
      projectedPoints: toNumber(projectedPoints),
      stats,
    };
  }));
}

async function upsertOwner(client, name) {
  const result = await client.query(
    `INSERT INTO owners (name) VALUES ($1)
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
     RETURNING id`,
    [name]
  );
  return result.rows[0].id;
}

async function main() {
  const config = loadConfig();
  const season = Number(config.season);
  const week = Number(config.currentWeek);
  const outputDir = path.join(CURRENT_SEASON_DIR, "output", String(season), `week-${week}`);
  const client = await pool.connect();

  try {
    await client.query("BEGIN");
    const teams = [];
    const ownerIds = new Map();

    for (const configuredTeam of config.teams) {
      const filePath = path.join(outputDir, `team-${configuredTeam.teamId}.json`);
      if (!fs.existsSync(filePath)) {
        throw new Error(`Missing scrape output: ${filePath}`);
      }

      const payload = JSON.parse(fs.readFileSync(filePath, "utf8"));
      if (payload.status !== "stats_available" || !payload.roster?.length) {
        throw new Error(`Team ${configuredTeam.teamId} does not have usable roster data.`);
      }

      const ownerId = await upsertOwner(client, configuredTeam.owner);
      ownerIds.set(configuredTeam.owner, ownerId);
      const teamName = payload.teamName || configuredTeam.teamName;
      const pointsScored = toNumber(payload.summary?.detectedScore);
      const opponentTeamName = extractOpponentTeamName(payload);

      await client.query(
        `INSERT INTO teams_by_season (season, owner_id, team_name, draft_order)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (season, owner_id) DO UPDATE SET
           team_name = EXCLUDED.team_name, draft_order = EXCLUDED.draft_order`,
        [season, ownerId, teamName, configuredTeam.draftOrder]
      );
      await client.query(
        `INSERT INTO team_yahoo_ids (season, league_id, yahoo_team_id, owner_id, team_name)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (season, yahoo_team_id) DO UPDATE SET
           league_id = EXCLUDED.league_id, owner_id = EXCLUDED.owner_id, team_name = EXCLUDED.team_name`,
        [season, config.leagueId, Number(configuredTeam.teamId), ownerId, teamName]
      );

      teams.push({
        payload,
        ownerId,
        teamName,
        pointsScored,
        opponentTeamName,
        players: extractPlayerRows(payload),
      });
    }

    for (const team of teams) {
      const opponent = teams.find((candidate) => candidate.teamName === team.opponentTeamName);
      await client.query(
        `INSERT INTO weekly_matchups
          (season, week, owner_id, team_name, points_scored,
           opponent_owner_id, opponent_team_name, opponent_points)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (season, week, owner_id) DO UPDATE SET
           team_name = EXCLUDED.team_name, points_scored = EXCLUDED.points_scored,
           opponent_owner_id = EXCLUDED.opponent_owner_id,
           opponent_team_name = EXCLUDED.opponent_team_name,
           opponent_points = EXCLUDED.opponent_points`,
        [
          season,
          week,
          team.ownerId,
          team.teamName,
          team.pointsScored,
          opponent?.ownerId || null,
          team.opponentTeamName,
          opponent?.pointsScored || null,
        ]
      );

      await client.query(
        "DELETE FROM player_weekly_stats WHERE season = $1 AND week = $2 AND owner_id = $3",
        [season, week, team.ownerId]
      );
      for (const player of team.players) {
        await client.query(
          `INSERT INTO player_weekly_stats
            (season, week, owner_id, position_group, pos, player_name,
             is_bench, bye, fan_pts, proj_pts, stats)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
          [
            season,
            week,
            team.ownerId,
            player.positionGroup,
            player.pos,
            player.playerName,
            player.isBench,
            player.bye,
            player.fanPoints,
            player.projectedPoints,
            JSON.stringify(player.stats),
          ]
        );
      }
    }

    await client.query("COMMIT");
    console.log(`Ingested ${teams.length} teams and ${teams.reduce((total, team) => total + team.players.length, 0)} player rows for ${season} week ${week}.`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

main().catch((error) => {
  console.error("Current-week ingestion failed:", error);
  process.exit(1);
});
