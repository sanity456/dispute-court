export type SqlValue = string | number | null;
export type SqlResult<T = Record<string, unknown>> = {
  results: T[];
  success: boolean;
  meta: { changes: number };
};
export interface Prepared {
  bind(...values: SqlValue[]): Prepared;
  first<T = Record<string, unknown>>(column?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<SqlResult<T>>;
  run(): Promise<SqlResult>;
}
export interface Database {
  prepare(sql: string): Prepared;
  batch(statements: Prepared[]): Promise<SqlResult[]>;
}
