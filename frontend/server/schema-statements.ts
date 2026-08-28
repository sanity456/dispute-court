export function schemaStatements(sql: string) {
  return sql
    .split("--> statement-breakpoint")
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) =>
      s
        .replace(/^CREATE TABLE /, "CREATE TABLE IF NOT EXISTS ")
        .replace(
          /^CREATE (UNIQUE )?INDEX /,
          (_, unique) => "CREATE " + (unique ?? "") + "INDEX IF NOT EXISTS ",
        ),
    );
}
