import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
const command = process.argv[2];
if (!["dev", "build", "start"].includes(command))
  throw new Error("Choose dev, build or start.");
const child = spawn(
  process.execPath,
  [
    fileURLToPath(import.meta.resolve("next/dist/bin/next")),
    command,
    ...(command === "start" ? [] : ["--webpack"]),
    ...process.argv.slice(3),
  ],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      PRODUCT_HOSTING_TARGET: "vercel",
      NEXT_TELEMETRY_DISABLED: "1",
    },
  },
);
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code ?? 1;
});
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => child.kill(signal));
