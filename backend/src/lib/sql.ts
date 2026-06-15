/**
 * Split a .sql file into individual statements for mysql2 (which has
 * multipleStatements disabled by default).
 *
 * Strips full-line `--` comments FIRST so a leading comment block can't get
 * glued to (and discard) the first real statement, then splits on `;` that
 * end a line.
 */
export function splitSqlStatements(sql: string): string[] {
  const withoutComments = sql
    .split("\n")
    .filter((line) => !line.trim().startsWith("--"))
    .join("\n");

  return withoutComments
    .split(/;\s*$/m)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}
