// Check every source file, including Windows cloud-backed reparse files that
// glob-based directory discovery can silently skip. No source is rewritten.
import { readdir, readFile, stat } from "node:fs/promises";
import { resolve, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as prettier from "prettier";

const root = fileURLToPath(new URL("../", import.meta.url));
const targets = [
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
];
let checked = 0,
  failed = 0;
async function check(path) {
  const info = await stat(path);
  if (info.isDirectory()) {
    for (const name of (await readdir(path)).sort())
      await check(join(path, name));
    return;
  }
  const { inferredParser } = await prettier.getFileInfo(path);
  if (!inferredParser) return;
  const options = await prettier.resolveConfig(path);
  checked++;
  if (
    !(await prettier.check(await readFile(path, "utf8"), {
      ...options,
      filepath: path,
    }))
  ) {
    failed++;
    console.error("Formatting differs: " + path);
  }
}
for (const target of targets) await check(resolve(root, target));
console.log(
  `Checked ${checked} source files; ${failed} formatting differences.`,
);
process.exitCode = failed ? 1 : 0;
