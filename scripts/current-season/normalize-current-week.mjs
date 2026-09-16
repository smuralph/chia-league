import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, "output");

function readTeamPayload(season, week, teamId) {
  const filePath = path.join(OUTPUT_DIR, String(season), `week-${week}`, `team-${teamId}.json`);
  if (!fs.existsSync(filePath)) {
    return null;
  }

  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function normalizeTeamWeek(payload) {
  const toNumber = (value) => {
    if (value === undefined || value === null || value === "" || value === "-") return null;
    const number = Number(value);
    return Number.isNaN(number) ? null : number;
  };

  const playerStats = (payload.roster || []).flatMap((table) => table.rows.map((row) => {
    const position = row.Pos || null;
    const playerName = row[table.sectionLabel] || null;
    const fanPointsValue = row["Fantasy - Fan Pts"] ?? row["Fan Pts"];
    const projectedPointsValue = row["Fantasy - Proj Pts"] ?? row["Proj Pts"];
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
      position,
      playerName,
      isBench: position === "BN",
      bye: toNumber(row.Bye),
      fanPoints: toNumber(fanPointsValue),
      projectedPoints: toNumber(projectedPointsValue),
      stats,
    };
  }));

  return {
    season: payload.season,
    week: payload.week,
    teamId: payload.teamId,
    owner: payload.owner,
    teamName: payload.teamName || null,
    teamNameHistory: payload.teamNameHistory || [
      {
        season: payload.season,
        week: payload.week,
        teamName: payload.teamName || null,
        owner: payload.owner,
      },
    ],
    ownerVerified: payload.validation?.ownerVerified ?? false,
    matchup: {
      pointsScored: toNumber(payload.summary?.detectedScore),
    },
    roster: payload.roster || [],
    playerStats,
  };
}

function main() {
  const configPath = path.join(__dirname, "config.json");
  if (!fs.existsSync(configPath)) {
    console.error("Missing config.json. Copy config.example.json and fill in the season settings before running normalization.");
    process.exit(1);
  }

  const config = JSON.parse(fs.readFileSync(configPath, "utf8"));
  const normalized = [];

  for (const team of config.teams) {
    const payload = readTeamPayload(config.season, config.currentWeek, team.teamId);
    if (!payload) {
      console.warn(`No payload found for ${team.owner} (${team.teamId})`);
      continue;
    }

    normalized.push(normalizeTeamWeek(payload));
  }

  console.log(JSON.stringify(normalized, null, 2));
}

main();
