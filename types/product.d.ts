declare module "@product/database" {
  export function binding(): import("../server/database-types").Database;
}
declare module "@product/auth" {
  export function authenticate(request: Request): string | Promise<string>;
  export function authRequest(
    request: import("next/server").NextRequest,
    context: { params: Promise<{ path: string[] }> },
  ): Promise<Response>;
}
declare module "*.sql?raw" {
  const sql: string;
  export default sql;
}
