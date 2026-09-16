import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = path.join(__dirname, "output");

function loadConfig() {
  const configPath = path.join(__dirname, "config.json");
  if (!fs.existsSync(configPath)) {
    console.error("Missing config.json. Copy config.example.json to config.json and fill in your league settings.");
    process.exit(1);
  }

  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

function resolveStorageStatePath(config) {
  const repoRoot = path.resolve(__dirname, "..", "..");
  const configured = config.yahoo?.storageStatePath || "./scripts/yahoo-scrape/storageState.json";

  if (path.isAbsolute(configured)) {
    return configured;
  }

  return path.resolve(repoRoot, configured.replace(/^\.\//, ""));
}

function buildTeamUrl({ season, leagueId, teamId, week }) {
  return `https://football.fantasysports.yahoo.com/f1/${leagueId}/${teamId}/team?&week=${week}`;
}

function ensureOutputDir(season, week) {
  const dir = path.join(OUTPUT_DIR, String(season), `week-${week}`);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

async function verifyOwnerMatch({ page, owner, teamName }) {
  return page.evaluate(({ ownerName, teamNameValue }) => {
    const text = document.body.innerText || "";
    const title = document.title || "";
    const normalizedText = text.toLowerCase();
    const normalizedOwner = ownerName.toLowerCase();
    const normalizedTeamName = (teamNameValue || "").toLowerCase();

    return {
      title,
      ownerMatched: normalizedText.includes(normalizedOwner),
      teamNameMatched: normalizedTeamName ? normalizedText.includes(normalizedTeamName) : false,
      ownerName,
      teamNameValue,
    };
  }, { ownerName: owner, teamNameValue: teamName });
}

function textFromSelectors(doc, selectors) {
  for (const selector of selectors) {
    const node = doc.querySelector(selector);
    if (node && node.textContent) {
      const cleaned = node.textContent.replace(/\s+/g, " ").trim();
      if (cleaned) return cleaned;
    }
  }
  return null;
}

function extractRosterTables(doc) {
  const playerColumnLabels = ["Offense", "Kickers", "Defense/Special Teams"];

  const cellText = (element) => element.textContent.replace(/\s+/g, " ").trim();
  const playerCellText = (element) => {
    const link = element.querySelector("a");
    return link ? cellText(link) : cellText(element);
  };

  return Array.from(doc.querySelectorAll("table")).flatMap((table) => {
    const headerRows = Array.from(table.querySelectorAll("thead tr"));
    if (headerRows.length < 2) return [];

    const groupCells = Array.from(headerRows[0].children);
    const subCells = Array.from(headerRows[1].children);
    const expandedGroups = [];
    for (const cell of groupCells) {
      const span = Number(cell.colSpan || 1);
      for (let index = 0; index < span; index += 1) expandedGroups.push(cellText(cell));
    }

    const subHeaders = subCells.map(cellText);
    const playerColumnIndex = subHeaders.findIndex((header) => playerColumnLabels.includes(header));
    if (playerColumnIndex === -1) return [];

    const columns = subHeaders.map((header, index) => {
      const group = expandedGroups[index] || "";
      return group && group !== header ? `${group} - ${header}` : header;
    });
    const rows = Array.from(table.querySelectorAll("tbody tr")).map((row) => {
      const values = {};
      Array.from(row.children).forEach((cell, index) => {
        if (!columns[index]) return;
        values[columns[index]] = index === playerColumnIndex ? playerCellText(cell) : cellText(cell);
      });
      return values;
    });

    return [{
      sectionLabel: subHeaders[playerColumnIndex],
      columns: columns.filter(Boolean),
      rowCount: rows.length,
      rows,
    }];
  });
}

function extractLivePageSnapshot(doc, owner, teamName) {
  const selectorSets = {
    teamName: [
      "h1",
      "h2",
      "[data-test*='team-name']",
      "[data-test*='teamName']",
      "[class*='team-name']",
      "[class*='teamName']",
      ".team-name",
      ".teamName",
      ".header-team-name",
      ".TeamName",
    ],
    score: [
      ".team-score",
      ".matchup-score",
      "[data-test*='score']",
      "[class*='score']",
      "span[data-test*='points']",
    ],
    rosterTable: [
      "table",
      "[data-test*='roster']",
      ".roster",
      "[class*='roster']",
    ],
  };

  const teamNameText = textFromSelectors(doc, selectorSets.teamName);
  const scoreText = textFromSelectors(doc, selectorSets.score);

  return {
    detectedTeamName: teamNameText,
    detectedScore: scoreText,
    ownerMatched: Boolean(doc.body.innerText && doc.body.innerText.toLowerCase().includes(String(owner || "").toLowerCase())),
    teamNameMatched: teamNameText
      ? Boolean(teamNameText.toLowerCase().includes(String(teamName || "").toLowerCase())) || !teamName || String(teamName).startsWith("TBD")
      : false,
  };
}

async function extractTeamPageData({ page, owner, teamName }) {
  return page.evaluate(({ ownerName, teamNameValue }) => {
    const text = document.body.innerText || "";
    const title = document.title || "";
    const ownerMatch = text.toLowerCase().includes(String(ownerName || "").toLowerCase());

    const titleTeamMatch = title.match(/ - (.+?) \| Fantasy Football/i);
    const detectedTeamName = titleTeamMatch ? titleTeamMatch[1].trim() : null;
    const scoreMatch = text.match(/(\d+(?:\.\d+)?)\s+Total Points/i);
    const detectedScore = scoreMatch ? scoreMatch[1] : null;

    const cellText = (element) => element.textContent.replace(/\s+/g, " ").trim();
    const playerCellText = (element) => {
      const link = element.querySelector("a");
      return link ? cellText(link) : cellText(element);
    };
    const playerColumnLabels = ["Offense", "Kickers", "Defense/Special Teams"];
    const rosterTables = Array.from(document.querySelectorAll("table")).flatMap((table) => {
      const headerRows = Array.from(table.querySelectorAll("thead tr"));
      if (headerRows.length < 2) return [];
      const groupCells = Array.from(headerRows[0].children);
      const subCells = Array.from(headerRows[1].children);
      const expandedGroups = [];
      for (const cell of groupCells) {
        const span = Number(cell.colSpan || 1);
        for (let index = 0; index < span; index += 1) expandedGroups.push(cellText(cell));
      }
      const subHeaders = subCells.map(cellText);
      const playerColumnIndex = subHeaders.findIndex((header) => playerColumnLabels.includes(header));
      if (playerColumnIndex === -1) return [];
      const columns = subHeaders.map((header, index) => {
        const group = expandedGroups[index] || "";
        return group && group !== header ? `${group} - ${header}` : header;
      });
      const rows = Array.from(table.querySelectorAll("tbody tr")).map((row) => {
        const values = {};
        Array.from(row.children).forEach((cell, index) => {
          if (columns[index]) values[columns[index]] = index === playerColumnIndex ? playerCellText(cell) : cellText(cell);
        });
        return values;
      });
      return [{ sectionLabel: subHeaders[playerColumnIndex], columns, rowCount: rows.length, rows }];
    });

    const bodyText = text || "";
    const playerRows = rosterTables.flatMap((table) => table.rows);
    const hasNoPlayerStats = rosterTables.length === 0 || playerRows.length === 0;

    return {
      title,
      textLength: text.length,
      ownerMatched: ownerMatch,
      teamNameMatched: detectedTeamName
        ? detectedTeamName.toLowerCase().includes(String(teamNameValue || "").toLowerCase()) || !teamNameValue || String(teamNameValue).startsWith("TBD")
        : false,
      detectedTeamName,
      detectedScore,
      rosterTables,
      rosterPreview: playerRows,
      bodySnippet: text.slice(0, 1500),
      hasNoPlayerStats,
      pageState: hasNoPlayerStats ? "waiting_for_weekly_stats" : "stats_available",
    };
  }, { ownerName: owner, teamNameValue: teamName });
}

async function scrapeTeamWeek({ season, leagueId, teamId, owner, teamName, week, page }) {
  const url = buildTeamUrl({ season, leagueId, teamId, week });
  await page.goto(url, { waitUntil: "domcontentloaded" });

  const pageIdentity = await verifyOwnerMatch({ page, owner, teamName });
  const pageSnapshot = await extractTeamPageData({ page, owner, teamName });

  const observedTeamName = pageSnapshot.detectedTeamName || teamName || null;
  const payload = {
    season,
    week,
    leagueId,
    teamId,
    owner,
    teamName: observedTeamName,
    teamNameHistory: [
      {
        season,
        week,
        teamName: observedTeamName,
        owner,
        observedAt: new Date().toISOString(),
      },
    ],
    url,
    scrapedAt: new Date().toISOString(),
    status: pageSnapshot.pageState || "stats_available",
    summary: {
      title: pageSnapshot.title,
      detectedTeamName: pageSnapshot.detectedTeamName,
      detectedScore: pageSnapshot.detectedScore,
      ownerMatched: pageIdentity.ownerMatched,
      teamNameMatched: pageSnapshot.teamNameMatched,
      hasNoPlayerStats: pageSnapshot.hasNoPlayerStats,
      pageState: pageSnapshot.pageState || "stats_available",
    },
    roster: pageSnapshot.rosterTables || [],
    players: pageSnapshot.rosterPreview || [],
    rawHtmlSnippet: pageSnapshot.bodySnippet || pageSnapshot.title || "",
    validation: {
      expectedOwner: owner,
      ownerVerified: pageIdentity.ownerMatched,
      expectedTeamName: teamName || null,
      teamNameVerified: pageSnapshot.teamNameMatched,
      warnings: pageIdentity.ownerMatched
        ? []
        : [`Owner mismatch check failed for ${owner}. Confirm the live Yahoo team page before writing normalized rows.`],
      waitingForWeeklyStats: pageSnapshot.hasNoPlayerStats,
      waitMessage: pageSnapshot.hasNoPlayerStats ? "Yahoo has not populated weekly roster or player stats for this team yet; retry later when the season data is live." : null,
    },
  };

  const dir = ensureOutputDir(season, week);
  const outPath = path.join(dir, `team-${teamId}.json`);
  fs.writeFileSync(outPath, JSON.stringify(payload, null, 2));
  console.log(`Saved ${outPath}`);
  if (!payload.validation.ownerVerified) {
    console.warn(`Owner verification warning: ${owner} did not match the live page text for team ${teamId}.`);
  }

  return payload;
}

async function main() {
  const config = loadConfig();
  const storageState = resolveStorageStatePath(config);

  if (!fs.existsSync(storageState)) {
    console.error(`No saved Yahoo session found at ${storageState}. Log in once with Playwright and save the browser session before running this job.`);
    process.exit(1);
  }

  const browser = await chromium.launch({ headless: config.yahoo?.headless ?? true });
  const context = await browser.newContext({ storageState });
  const page = await context.newPage();

  for (const team of config.teams) {
    console.log(`Scraping ${config.season} / week ${config.currentWeek} / ${team.owner} (${team.teamId})`);
    await scrapeTeamWeek({
      season: config.season,
      leagueId: config.leagueId,
      teamId: team.teamId,
      owner: team.owner,
      teamName: team.teamName,
      week: config.currentWeek,
      page,
    });
  }

  await browser.close();
}

main().catch((error) => {
  console.error("Current-season scrape failed:", error);
  process.exit(1);
});
