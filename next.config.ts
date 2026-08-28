import type { NextConfig } from "next";
import { resolve } from "node:path";

const nextConfig: NextConfig = {
  distDir: ".next-vercel",
  env: {
    NEXT_PUBLIC_AUTH_PROVIDER: "neon",
    NEXT_PUBLIC_SITE_ORIGIN:
      process.env.NEXT_PUBLIC_SITE_ORIGIN ||
      (process.env.VERCEL_URL
        ? "https://" + process.env.VERCEL_URL
        : "http://localhost:" + (process.env.PORT || "3000")),
  },
  typescript: { tsconfigPath: "tsconfig.vercel.json" },
  webpack(config) {
    config.resolve.alias["@product/database"] = resolve(
      process.cwd(),
      "server/database.neon.ts",
    );
    config.resolve.alias["@product/auth"] = resolve(
      process.cwd(),
      "server/auth.neon.ts",
    );
    config.module.rules.push({
      test: /\.sql$/,
      resourceQuery: /raw/,
      type: "asset/source",
    });
    return config;
  },
};
// Vinext also reads this file. Opt in explicitly so Sites never receives Neon
// identity, Vercel origins, or Node-specific build configuration.
export default process.env.PRODUCT_HOSTING_TARGET === "vercel"
  ? nextConfig
  : {};
