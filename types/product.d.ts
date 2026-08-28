declare module "virtual:product-database" {
  export function binding(): import("../server/database-types").Database;
}
declare module "*.sql?raw" {
  const sql: string;
  export default sql;
}
