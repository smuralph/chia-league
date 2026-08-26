import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var _chiaLeaguePool: Pool | undefined;
}

// Reuse the pool across hot reloads / serverless invocations in the same
// process instead of opening a new one per request.
export const pool =
  global._chiaLeaguePool ??
  new Pool({
    connectionString: process.env.DATABASE_URL,
  });

if (process.env.NODE_ENV !== "production") {
  global._chiaLeaguePool = pool;
}
