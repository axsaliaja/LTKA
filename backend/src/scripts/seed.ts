/**
 * Loads seed/seed.sql into the database. Run AFTER migrate.
 * Idempotent: seed uses INSERT IGNORE so re-running won't duplicate.
 *
 * Usage: npm run seed
 */
import fs from "fs";
import path from "path";
import { pool } from "../lib/db";
import { splitSqlStatements } from "../lib/sql";

async function main() {
  const seedPath = path.join(__dirname, "..", "..", "seed", "seed.sql");
  if (!fs.existsSync(seedPath)) {
    console.error(`seed.sql not found at ${seedPath}`);
    process.exit(1);
  }
  const sql = fs.readFileSync(seedPath, "utf8");
  const statements = splitSqlStatements(sql);

  const conn = await pool.getConnection();
  try {
    for (const stmt of statements) {
      await conn.query(stmt);
    }
    console.log(`Seed applied (${statements.length} statements).`);
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error("Seed failed:", e);
  process.exit(1);
});
