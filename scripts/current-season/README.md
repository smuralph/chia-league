# Current-season fallback: Option B

This folder stores the ready-to-activate scrape + normalize pipeline for when the new fantasy season begins and Yahoo API access is still unavailable.

## Goal

Keep the app working without changing the app’s normal data model:

- scrape current-season Yahoo team pages
- normalize them into the same schema the app already uses
- upsert records into PostgreSQL
- let [src/lib/queries.ts](../../src/lib/queries.ts) keep reading the same tables

## Why this is the right fallback

This follows the same pattern already used in the historical ingestion flow:

- the historical scraper writes raw files in [scripts/yahoo-scrape](../yahoo-scrape)
- the ingester upserts normalized rows in [scripts/ingest](../ingest)
- the app reads from Postgres and doesn't care where the data came from

That means the current-season pipeline is not a second app architecture — it is just another ingestion source feeding the same database model.

## What this pipeline should cover

When the season starts, the fallback job should collect:

- league standings
- weekly matchup results
- points scored by each manager
- each team roster for the active week
- player stat rows for the active week
- trailer flags such as playoff status / pending weeks / inconsistent data

## Recommended flow

1. Log into Yahoo once with Playwright and save a browser session.
2. Determine the current week from league pages.
3. For each team in the league, visit the weekly team page.
4. Extract the roster + player stat table.
5. Normalize the values into the app’s existing schema.
6. Upsert rows to Postgres.
7. Repeat per week, or run daily to catch updates.

## Files in this folder

- `config.example.json` — active season settings and team IDs
- `scrape-current-week.mjs` — browser automation to collect weekly roster + matchup pages
- `normalize-current-week.mjs` — map raw scraped rows into app-friendly objects
- `run-current-season.mjs` — orchestration entry point (optional later)

## Typical schedule

Use a lightweight scheduler or a one-off script during the season:

- nightly sync: good default
- post-matchup refresh: useful if you want more current scores
- manual run: good for debugging and test runs

## Data mapping targets

These are the app-ready structures to target:

- `owners`
- `teams_by_season`
- `weekly_matchups`
- `player_weekly_stats`

## Ownership rule

The owner is the stable identity for the app. The team name is mutable and can change week to week, so the scrape should always:

- confirm the owner matches the live Yahoo team page before writing a row
- keep `owner` as the canonical key
- log the observed `team_name` by week in raw output and normalized records
- never replace the owner because a team name changed

This keeps the data model aligned with the schema in [db/schema.sql](../../db/schema.sql), which ties weekly rows to `owner_id` rather than a changing team label.

## Failure handling

This pipeline should log and continue when a page fails:

- save raw HTML or JSON for later debugging
- retry on transient failures
- skip rows with missing values instead of crashing the whole run
- log a failed week/team to a failure file

## Start-up checklist

When the season kicks off, this should be in place:

- [ ] valid Yahoo login session saved locally
- [ ] league ID and current season recorded in config
- [ ] list of team IDs and owner names ready
- [ ] scraper can navigate to each weekly team page
- [ ] normalization layer writes rows to the correct DB tables
- [ ] daily or weekly run is scheduled
- [ ] raw output is stored for inspection if Yahoo changes the DOM

## This is intentionally a fallback

This should not replace the Yahoo API when it comes in. It is simply the best backup plan if access is denied or delayed.

Once the API is approved, the scraper and the ingester can stay in place while only the fetch step changes.
