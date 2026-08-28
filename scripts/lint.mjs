import { spawnSync } from "node:child_process";
import { dirname, delimiter, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const eslint = join(
  dirname(fileURLToPath(import.meta.resolve("eslint/package.json"))),
  "bin/eslint.js",
);

// Next's CommonJS parser requires Next from the host project. Keep that lookup
// working with both ordinary and externally located pnpm virtual stores.
const result = spawnSync(
  process.execPath,
  [
    eslint,
    "app",
    "components",
    "lib",
    "server",
    "db",
    "tests",
    "scripts",
    "vite.config.ts",
    "drizzle.config.ts",
    "eslint.config.mjs",
    "--max-warnings",
    "0",
    ...process.argv.slice(2),
  ],
  {
    cwd: root,
    env: {
      ...process.env,
      NODE_PATH: [join(root, "node_modules"), process.env.NODE_PATH]
        .filter(Boolean)
        .join(delimiter),
    },
    stdio: "inherit",
  },
);
if (result.error) console.error(result.error.message);
process.exitCode = result.status ?? 1;
