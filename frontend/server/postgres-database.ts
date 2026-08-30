import { neon } from "@neondatabase/serverless";
import type { Database, Prepared, SqlResult, SqlValue } from "./database-types";
import { postgresParameters } from "./postgres-parameters.ts";
import { isIsolatedDatabaseSchema } from "./release-data.ts";

type Result = {
  rows: Record<string, unknown>[];
  rowCount: number | null;
  fields: { name: string; dataTypeID: number }[];
};
export function postgresResult<T = Record<string, unknown>>(
  result: Result,
): SqlResult<T> {
  const integers = result.fields
    .filter((field) => field.dataTypeID === 20)
    .map((field) => field.name);
  const rows = result.rows.map((row) => {
    const value = { ...row };
    for (const field of integers) {
      if (value[field] === null || value[field] === undefined) continue;
      const number = Number(value[field]);
      if (!Number.isSafeInteger(number))
        throw new Error("Database integer exceeds the safe range.");
      value[field] = number;
    }
    return value as T;
  });
  return {
    results: rows,
    success: true,
    meta: { changes: result.rowCount ?? 0 },
  };
}
export function createPostgresDatabase(
  connectionString: string,
  schema?: string,
): Database {
  const url = new URL(connectionString);
  if (
    !["postgres:", "postgresql:"].includes(url.protocol) ||
    !url.hostname.endsWith(".neon.tech")
  )
    throw new Error("A valid Neon database connection is required.");
  if (schema !== undefined && !isIsolatedDatabaseSchema(schema))
    throw new Error(
      "Only isolated verification or v3 release schemas are supported.",
    );
  const client = neon(connectionString, { fullResults: true });
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
    query() {
      const query = postgresParameters(this.sql);
      if (query.count !== this.values.length)
        throw new Error("SQL parameter count does not match.");
      return client.query(query.sql, this.values, { fullResults: true });
    }
    async all<T = Record<string, unknown>>(): Promise<SqlResult<T>> {
      const prepared = postgresParameters(this.sql);
      if (prepared.count !== this.values.length)
        throw new Error("SQL parameter count does not match.");
      const raw = schema
        ? (
            await client.transaction(
              [
                client.query('SET LOCAL search_path TO "' + schema + '"'),
                this.query(),
              ],
              {
                fullResults: true,
                fetchOptions: { signal: AbortSignal.timeout(20000) },
              },
            )
          )[1]
        : await client.query(prepared.sql, this.values, {
            fullResults: true,
            fetchOptions: { signal: AbortSignal.timeout(20000) },
          });
      return postgresResult<T>(raw);
    }
    async first<T = Record<string, unknown>>(
      column?: string,
    ): Promise<T | null> {
      const { results } = await this.all<Record<string, unknown>>();
      const row = results[0];
      return row ? ((column ? row[column] : row) as T) : null;
    }
    async run() {
      return this.all();
    }
  }
  return {
    dialect: "postgres",
    prepare(sql) {
      return new Statement(sql);
    },
    async batch(statements) {
      if (!statements.length) return [];
      if (statements.some((statement) => !(statement instanceof Statement)))
        throw new Error("Cannot mix database instances in a transaction.");
      const queries = statements.map((statement) =>
        (statement as Statement).query(),
      );
      if (schema)
        queries.unshift(
          client.query('SET LOCAL search_path TO "' + schema + '"'),
        );
      const results = await client.transaction(queries, {
        fullResults: true,
        fetchOptions: { signal: AbortSignal.timeout(30000) },
      });
      return (schema ? results.slice(1) : results).map((result) =>
        postgresResult(result),
      );
    },
  };
}
