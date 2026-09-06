import type { NextConfig } from "next";
import { resolve } from "node:path";
import { documentSecurityHeaders } from "./server/document-security.ts";

const nextConfig: NextConfig = {
  distDir: ".next-vercel",
  async headers() {
    return [{ source: "/:path*", headers: documentSecurityHeaders }];
  },
  env: {
    NEXT_PUBLIC_AUTH_PROVIDER: "wallet",
    NEXT_PUBLIC_SITE_ORIGIN: "https://dispute-court-studionet.vercel.app",
  },
  typescript: { tsconfigPath: "tsconfig.vercel.json" },
  webpack(config) {
    config.resolve.alias["@product/database"] = resolve(
      process.cwd(),
      "server/database.neon.ts",
    );
    config.resolve.alias["@product/auth"] = resolve(
      process.cwd(),
      "server/auth.wallet.ts",
    );
    config.module.rules.push({
      test: /\.sql$/,
      resourceQuery: /raw/,
      type: "asset/source",
    });
    return config;
  },
};
// Vinext also reads this file. Keep Vercel origins and Node-specific build
// configuration opt-in; wallet authentication is used on both targets.
export default process.env.PRODUCT_HOSTING_TARGET === "vercel"
  ? nextConfig
  : { headers: nextConfig.headers };
