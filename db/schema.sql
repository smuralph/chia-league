-- Owners persist across years even as team names change; everything else
-- hangs off owner_id so manager-level stats/dashboards can aggregate cleanly.
CREATE TABLE IF NOT EXISTS owners (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL
);

CREATE TABLE IF NOT EXISTS teams_by_season (
  id SERIAL PRIMARY KEY,
  season INT NOT NULL,
  owner_id INT NOT NULL REFERENCES owners(id),
  team_name TEXT NOT NULL,
  since_year INT,
  final_rank INT,
  wins INT,
  losses INT,
  ties INT,
  points_for NUMERIC,
  points_against NUMERIC,
  made_playoffs BOOLEAN,
  moves INT,
  champion BOOLEAN,
  podium BOOLEAN,
  draft_order INT,
  UNIQUE (season, owner_id)
);

-- Idempotent for pre-existing databases created before draft_order existed.
ALTER TABLE teams_by_season ADD COLUMN IF NOT EXISTS draft_order INT;

CREATE TABLE IF NOT EXISTS weekly_matchups (
  id SERIAL PRIMARY KEY,
  season INT NOT NULL,
  week INT NOT NULL,
  owner_id INT NOT NULL REFERENCES owners(id),
  team_name TEXT NOT NULL,
  points_scored NUMERIC,
  opponent_owner_id INT REFERENCES owners(id),
  opponent_team_name TEXT,
  opponent_points NUMERIC,
  UNIQUE (season, week, owner_id)
);

-- Resolves Yahoo's per-season team_id (used in scrape URLs) to an owner,
-- derived by fingerprint-matching computed weekly totals against
-- weekly_matchups.points_scored (see scripts/ingest/resolve-team-ids.mjs).
CREATE TABLE IF NOT EXISTS team_yahoo_ids (
  season INT NOT NULL,
  league_id TEXT NOT NULL,
  yahoo_team_id INT NOT NULL,
  owner_id INT REFERENCES owners(id),
  team_name TEXT,
  PRIMARY KEY (season, yahoo_team_id)
);

-- One row per player per team per week. Offense/Kickers/Defense have
-- different stat columns, so the sport-specific numbers live in `stats`
-- (jsonb) rather than as a wide, mostly-null column set.
CREATE TABLE IF NOT EXISTS player_weekly_stats (
  id SERIAL PRIMARY KEY,
  season INT NOT NULL,
  week INT NOT NULL,
  owner_id INT NOT NULL REFERENCES owners(id),
  position_group TEXT NOT NULL, -- 'Offense' | 'Kickers' | 'Defense/Special Teams'
  pos TEXT,
  player_name TEXT,
  is_bench BOOLEAN NOT NULL,
  bye INT,
  fan_pts NUMERIC,
  proj_pts NUMERIC,
  stats JSONB
);

CREATE INDEX IF NOT EXISTS idx_teams_by_season_season ON teams_by_season(season);
CREATE INDEX IF NOT EXISTS idx_weekly_matchups_season_week ON weekly_matchups(season, week);
CREATE INDEX IF NOT EXISTS idx_player_weekly_stats_lookup ON player_weekly_stats(season, week, owner_id);
