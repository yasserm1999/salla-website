// Runs one or more supabase/*.sql files against the database in DATABASE_URL.
//
//   node scripts/run-sql.mjs supabase/stock.sql supabase/areas.sql
//
// Reads .env.local itself so the password never has to be typed on a command
// line, where it would be kept in the shell's history.

import { readFileSync } from "node:fs";
import pg from "pg";

const env = readFileSync(new URL("../.env.local", import.meta.url), "utf8");
const url = env.match(/^DATABASE_URL=["']?([^"'\r\n]+)/m)?.[1];
if (!url || url.includes("[YOUR-PASSWORD]")) {
  console.error("DATABASE_URL is missing from .env.local, or still has [YOUR-PASSWORD] in it.");
  process.exit(1);
}

const client = new pg.Client({ connectionString: url, ssl: { rejectUnauthorized: false } });
await client.connect();
try {
  for (const file of process.argv.slice(2)) {
    await client.query(readFileSync(file, "utf8"));
    console.log(`ran ${file}`);
  }
} finally {
  await client.end();
}
