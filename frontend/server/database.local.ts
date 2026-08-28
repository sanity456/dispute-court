import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import type { Database, Prepared, SqlResult, SqlValue } from "./database-types";
export function createLocalDatabase(
  filename: string,
): Database & { close(): void } {
  const db = new DatabaseSync(filename);
  db.exec("PRAGMA foreign_keys = ON");
  db.exec("PRAGMA busy_timeout = 5000");
  class Statement implements Prepared {
    readonly sql: string;
    readonly values: SqlValue[];
    constructor(sql: string, values: SqlValue[] = []) {
      this.sql = sql;
      this.values = values;
    }
    bind(...values: SqlValue[]) {
      return new Statement(this.sql, values);
    }
    execute(): SqlResult {
      const statement = db.prepare(this.sql);
      if (
        /^\s*(SELECT|PRAGMA|WITH|EXPLAIN)\b/i.test(this.sql) ||
        /\bRETURNING\b/i.test(this.sql)
      ) {
        const results = statement.all(...this.values) as Record<
          string,
          unknown
        >[];
        return { results, success: true, meta: { changes: results.length } };
      }
      const result = statement.run(...this.values);
      return {
        results: [],
        success: true,
        meta: { changes: Number(result.changes) },
      };
    }
    async first<T = Record<string, unknown>>(
      column?: string,
    ): Promise<T | null> {
      const row = db.prepare(this.sql).get(...this.values);
      return row ? ((column ? row[column] : row) as T) : null;
    }
    async all<T = Record<string, unknown>>(): Promise<SqlResult<T>> {
      return this.execute() as SqlResult<T>;
    }
    async run() {
      return this.execute();
    }
  }
  return {
    prepare(sql) {
      return new Statement(sql);
    },
    async batch(statements) {
      db.exec("BEGIN IMMEDIATE");
      try {
        const results = statements.map((s) => (s as Statement).execute());
        db.exec("COMMIT");
        return results;
      } catch (error) {
        db.exec("ROLLBACK");
        throw error;
      }
    },
    close() {
      db.close();
    },
  };
}
let database: Database | undefined;
export function binding(): Database {
  if (process.env.CODEX_LOCAL_PREVIEW !== "1")
    throw new Error(
      "Local database is only available in explicit local preview mode.",
    );
  if (!database) {
    const directory = join(process.cwd(), ".local-data");
    mkdirSync(directory, { recursive: true });
    database = createLocalDatabase(join(directory, "product.sqlite"));
  }
  return database;
}
