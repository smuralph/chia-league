# Yahoo historical data scraper

Pulls per-team, per-week roster + stats pages from Yahoo Fantasy Football
(2014-2025) for this league, since Yahoo's Fantasy API currently requires an
approved application and there's no export/download option on the site.

Runs entirely on your machine, using your own logged-in Yahoo session. Your
credentials and session are never sent anywhere else — `storageState.json`
stays local and is gitignored.

## Setup

```bash
cd scripts/yahoo-scrape
npm install
npx playwright install chromium
```

## 1. Log in (one-time, or again if the session expires)

```bash
npm run login
```

A real browser window opens. Log into Yahoo yourself, then press Enter in
the terminal. This saves your session to `storageState.json`.

## 2. Fill in config.csv

Copy `config.example.csv` to `config.csv` and fill in every season/team:

```
season,league_id,team_id,team_name,owner,weeks
2025,561841,11,Omar's 12-gauge,Rafael,1-17
```

`weeks` is optional (defaults to `1-17`) — set it per season if a season had
a different length (e.g. `1-16` for pre-2021 seasons).

## 3. Smoke test one page first

```bash
npm run smoke-test -- --season=2025 --league=561841 --team=11 --week=1
```

This opens a visible browser, scrapes just that one page, and prints the
extracted JSON so we can check the columns came out right before running the
full batch. Share the output if anything looks off (extra/missing columns,
misaligned data) so the parser can be adjusted.

## 4. Full run

```bash
npm run scrape
```

Runs headless, ~2-4 seconds between pages, one page at a time. Safe to
interrupt (Ctrl+C) and rerun — already-scraped pages (found in `output/`) are
skipped, so it resumes where it left off.

To do it in smaller chunks:

```bash
npm run scrape -- --limit=100
```

## Output

One JSON file per season/team/week:

```
output/<season>/<team_id>/week-<week>.json
```

Each file contains every `<table>` found on the page (offense, kickers,
defense/special teams come out as separate table entries), with columns
inferred from Yahoo's header labels and every row of player stats.
