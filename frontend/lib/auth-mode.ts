export const usesNeonAuth = process.env.NEXT_PUBLIC_AUTH_PROVIDER === "neon";
export const signInPath = usesNeonAuth
  ? "/auth/sign-in"
  : "/signin-with-chatgpt?return_to=/";
export const signOutPath = usesNeonAuth
  ? "/auth/sign-out"
  : "/signout-with-chatgpt?return_to=/";
