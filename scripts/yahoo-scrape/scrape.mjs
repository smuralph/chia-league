// Scrapes Yahoo Fantasy Football team/week roster+stats pages for historical
// data collection, using your own already-authenticated session (see login.mjs).
//
// Usage:
//   node scrape.mjs --smoke-test              one page, prints result, no config.csv needed if --season/--league/--team given
//   node scrape.mjs --smoke-test --season=2025 --league=561841 --team=11 --week=1
//   node scrape.mjs                            full run over config.csv
//   node scrape.mjs --limit=50                 cap this run to 50 pages (resumable — rerun to continue)

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORAGE_STATE_PATH = path.join(__dirname, "storageState.json");
const CONFIG_PATH = path.join(__dirname, "config.csv");
const OUTPUT_DIR = path.join(__dirname, "output");

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k, v ?? true];
  })
);

function parseCsv(text) {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(",").map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = line.split(",").map((c) => c.trim());
    return Object.fromEntries(headers.map((h, i) => [h, cells[i] ?? ""]));
  });
}

function expandWeeks(weeksStr) {
  const s = weeksStr && weeksStr.length ? weeksStr : "1-17";
  const [start, end] = s.split("-").map(Number);
  const weeks = [];
  for (let w = start; w <= (end ?? start); w++) weeks.push(w);
  return weeks;
}

function buildJobs() {
  if (args["smoke-test"] && args.season && args.league && args.team) {
    return [
      {
        season: args.season,
        league_id: args.league,
        team_id: args.team,
        team_name: "smoke-test",
        owner: "",
        week: Number(args.week ?? 1),
      },
    ];
  }

  if (!fs.existsSync(CONFIG_PATH)) {
    console.error(`Missing ${CONFIG_PATH}. Copy config.example.csv to config.csv and fill it in.`);
    process.exit(1);
  }

  const rows = parseCsv(fs.readFileSync(CONFIG_PATH, "utf8"));
  const jobs = [];
  for (const row of rows) {
    for (const week of expandWeeks(row.weeks)) {
      jobs.push({
        season: row.season,
        league_id: row.league_id,
        team_id: row.team_id,
        team_name: row.team_name,
        owner: row.owner,
        week,
      });
    }
  }

  if (args["smoke-test"]) return jobs.slice(0, 1);
  return jobs;
}

function outputPath(job) {
  return path.join(OUTPUT_DIR, job.season, job.team_id, `week-${job.week}.json`);
}

function buildUrl(job) {
  return `https://football.fantasysports.yahoo.com/${job.season}/f1/${job.league_id}/${job.team_id}/team?&week=${job.week}`;
}

// Runs in the browser context. Extracts only the roster/stat tables we care
// about (Offense, Kickers, Defense/Special Teams) — identified by their
// player-column header — and skips Yahoo's glossary/legend/widget tables
// that appear elsewhere on the page. Combines the two-row header (group
// label + sub-column label) into flat column names.
function extractTables() {
  const PLAYER_COLUMN_LABELS = ["Offense", "Kickers", "Defense/Special Teams"];

  function cellText(el) {
    return el.textContent.replace(/\s+/g, " ").trim();
  }

  // Player name cells have extra glued-together text (video/forecast icons,
  // game result like "Final W 41-40 vs Bal"). The actual name is reliably
  // the text of the link to the player's page, so prefer that when present.
  function playerCellText(el) {
    const link = el.querySelector("a");
    return link ? cellText(link) : cellText(el);
  }

  const tables = Array.from(document.querySelectorAll("table"));

  const results = [];
  for (const table of tables) {
    const theadRows = Array.from(table.querySelectorAll("thead tr"));
    if (theadRows.length < 2) continue;

    const groupCells = Array.from(theadRows[0].children);
    const subCells = Array.from(theadRows[1].children);
    const expandedGroups = [];
    for (const cell of groupCells) {
      const span = Number(cell.colSpan || 1);
      const label = cellText(cell);
      for (let i = 0; i < span; i++) expandedGroups.push(label);
    }

    const rawSubHeaders = subCells.map(cellText);
    const playerColIndex = rawSubHeaders.findIndex((h) => PLAYER_COLUMN_LABELS.includes(h));
    if (playerColIndex === -1) continue; // not one of our three stat tables

    const columns = rawSubHeaders.map((sub, i) => {
      const group = expandedGroups[i] || "";
      return group && group !== sub ? `${group} - ${sub}` : sub;
    });

    const bodyRows = Array.from(table.querySelectorAll("tbody tr"));
    const rows = bodyRows.map((tr) => {
      const cellEls = Array.from(tr.children);
      const obj = {};
      cellEls.forEach((cellEl, i) => {
        const key = columns[i];
        if (!key) return; // drop unlabeled trailing icon/action column
        obj[key] = i === playerColIndex ? playerCellText(cellEl) : cellText(cellEl);
      });
      return obj;
    });

    results.push({
      sectionLabel: rawSubHeaders[playerColIndex], // "Offense" | "Kickers" | "Defense/Special Teams"
      columns: columns.filter(Boolean),
      rowCount: rows.length,
      rows,
    });
  }

  return results;
}

async function scrapeJob(page, job) {
  const url = buildUrl(job);
  await page.goto(url, { waitUntil: "domcontentloaded" });

  // The roster page may default to a "Matchup" or summary view; click the
  // Stats tab if present so the box-score table renders. Harmless if it's
  // already the active tab or not found under a different label.
  const statsTab = page.getByText("Stats", { exact: true }).first();
  try {
    await statsTab.click({ timeout: 3000 });
  } catch {
    // already on stats view, or tab not present under this exact label
  }

  await page.waitForSelector("table", { timeout: 15000 }).catch(() => {});
  await page.waitForTimeout(500); // let any late-rendering rows settle

  const tables = await page.evaluate(extractTables);

  return {
    season: job.season,
    league_id: job.league_id,
    team_id: job.team_id,
    team_name: job.team_name,
    owner: job.owner,
    week: job.week,
    url,
    scrapedAt: new Date().toISOString(),
    tables,
  };
}

// Courtesy delay is adaptive: we want at least MIN_GAP_MS between the start
// of one request and the next. If Yahoo's own page already took a while to
// render, that gap is already satisfied and we don't wait extra on top of
// it — we only top up the difference, plus a small jitter.
const MIN_GAP_MS = 3000;

function courtesyDelayMs(renderTimeMs) {
  const remaining = MIN_GAP_MS - renderTimeMs;
  const jitter = Math.floor(Math.random() * 800);
  return Math.max(0, remaining) + jitter;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const FAILURES_LOG_PATH = path.join(__dirname, "failures.log");
const MAX_ATTEMPTS = 4;
const RETRY_DELAYS_MS = [5000, 15000, 30000];

// Retries transient failures (network blips, page hiccups) so a long
// unattended run survives them instead of crashing the whole batch. A job
// that still fails after all attempts is logged and skipped — its output
// file is never written, so a later rerun retries it automatically.
async function scrapeJobWithRetry(page, job) {
  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      return await scrapeJob(page, job);
    } catch (err) {
      const isLastAttempt = attempt === MAX_ATTEMPTS;
      console.error(
        `  attempt ${attempt}/${MAX_ATTEMPTS} failed for ${job.season}/${job.league_id}/${job.team_id} week ${job.week}: ${err.message}`
      );
      if (isLastAttempt) {
        fs.appendFileSync(
          FAILURES_LOG_PATH,
          `${new Date().toISOString()} ${job.season} ${job.league_id} ${job.team_id} week ${job.week}: ${err.message}\n`
        );
        return null;
      }
      await sleep(RETRY_DELAYS_MS[attempt - 1]);
    }
  }
}

async function main() {
  if (!fs.existsSync(STORAGE_STATE_PATH)) {
    console.error("No saved session found. Run `npm run login` first.");
    process.exit(1);
  }

  const jobs = buildJobs();
  const limit = args.limit ? Number(args.limit) : Infinity;
  const isSmoke = Boolean(args["smoke-test"]);

  const browser = await chromium.launch({ headless: !isSmoke });
  const context = await browser.newContext({ storageState: STORAGE_STATE_PATH });
  let page = await context.newPage();

  // Yahoo's page is a heavy React app; a single Playwright page reused for
  // thousands of navigations accumulates memory (detached DOM, listeners)
  // until Node's heap runs out. Recycling the page periodically bounds that.
  const RECYCLE_EVERY = 75;
  let sinceRecycle = 0;

  let done = 0;
  for (const job of jobs) {
    if (done >= limit) break;

    const outPath = outputPath(job);
    if (!isSmoke && fs.existsSync(outPath)) {
      continue; // already scraped, resumable run
    }

    if (sinceRecycle >= RECYCLE_EVERY) {
      await page.close();
      page = await context.newPage();
      sinceRecycle = 0;
      console.log("  (recycled browser page to bound memory growth)");
    }

    console.log(`Scraping ${job.season} league ${job.league_id} team ${job.team_id} week ${job.week}...`);
    const jobStart = Date.now();
    const result = await scrapeJobWithRetry(page, job);
    const renderTimeMs = Date.now() - jobStart;

    if (result === null) {
      continue; // logged to failures.log; skip and keep the batch going
    }

    if (isSmoke) {
      console.log(JSON.stringify(result, null, 2));
    }

    fs.mkdirSync(path.dirname(outPath), { recursive: true });
    fs.writeFileSync(outPath, JSON.stringify(result, null, 2));

    done++;
    sinceRecycle++;
    if (done < jobs.length && !isSmoke) {
      const delay = courtesyDelayMs(renderTimeMs);
      console.log(`  rendered in ${renderTimeMs}ms, waiting ${delay}ms`);
      await page.waitForTimeout(delay);
    }
  }

  console.log(`Done. Scraped ${done} page(s) this run.`);
  await browser.close();
}

main();
