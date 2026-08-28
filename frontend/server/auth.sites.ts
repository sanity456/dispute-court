import { jsonResponse, siteUser } from "./security";
export const authenticate = siteUser;
export async function authRequest() {
  return jsonResponse(
    { error: "This host uses ChatGPT sign-in.", code: "not_found" },
    404,
  );
}
