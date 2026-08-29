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
  // TODO: map scraped team payload into the app schema.
  // The shape should eventually align with the existing database tables:
  // - owners
  // - teams_by_season
  // - weekly_matchups
  // - player_weekly_stats
  //
  // Important: owners are the stable identity. Team names can and do change,
  // so we log team names by week while preserving the owner record as the key.

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
    matchup: null,
    roster: [],
    playerStats: [],
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
