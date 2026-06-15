import mysql from "mysql2/promise";
import { config } from "../config";

/**
 * Shared MySQL connection pool. Uses mysql2/promise so we can `await` queries.
 * JSON columns (face_descriptor) are returned as parsed objects automatically.
 */
export const pool = mysql.createPool({
  host: config.db.host,
  port: config.db.port,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  // Keep DATETIME values as strings to avoid timezone surprises across
  // EC2 / RDS / browser. We do time math explicitly in JS using UTC.
  dateStrings: true,
});

/** Helper: run a SELECT and return typed rows. */
export async function query<T = any>(
  sql: string,
  params: any[] = []
): Promise<T[]> {
  const [rows] = await pool.query(sql, params);
  return rows as T[];
}

/** Helper: run an INSERT/UPDATE/DELETE and return the result header. */
export async function execute(
  sql: string,
  params: any[] = []
): Promise<{ affectedRows: number; insertId: number }> {
  const [result] = await pool.query(sql, params);
  return result as unknown as { affectedRows: number; insertId: number };
}
