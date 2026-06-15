/**
 * Runs every .sql file in src/migrations in lexical order.
 * Idempotent: migrations use CREATE TABLE IF NOT EXISTS.
 *
 * Usage: npm run migrate
 */
import fs from "fs";
import path from "path";
import { pool } from "../lib/db";
import { splitSqlStatements } from "../lib/sql";

async function main() {
  const dir = path.join(__dirname, "..", "migrations");
  const files = fs
    .readdirSync(dir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  const conn = await pool.getConnection();
  try {
    for (const file of files) {
      const sql = fs.readFileSync(path.join(dir, file), "utf8");
      console.log(`Applying migration: ${file}`);
      // multipleStatements is off by default; run statements one-by-one.
      const statements = splitSqlStatements(sql);
      for (const stmt of statements) {
        await conn.query(stmt);
      }
    }
    console.log("Migrations complete.");
  } finally {
    conn.release();
    await pool.end();
  }
}

main().catch((e) => {
  console.error("Migration failed:", e);
  process.exit(1);
});
