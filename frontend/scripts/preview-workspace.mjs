// Local-only UI regression fixture. No wallet, RPC, database, or signing adapter.
import { build } from "vite";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../", import.meta.url));
const fixture = "/tests/fixtures/workspace-browser.mjs";
const result = await build({
  configFile: false,
  envFile: false,
  root,
  build: { write: false, rollupOptions: { input: root + fixture.slice(1) } },
  plugins: [
    {
      name: "isolated-workspace-fixture",
      enforce: "pre",
      resolveId(source) {
        if (
          /^\.\.?\/(?:lib\/)?(?:useProtocol|genlayer|client)(?:\.ts)?$/.test(
            source,
          ) ||
          source === "next/navigation"
        )
          return "\0workspace-fixture";
      },
      load(id) {
        if (id === "\0workspace-fixture")
          return `export * from ${JSON.stringify(fixture)};`;
      },
    },
  ],
});
const output = result.output;
const entry = output.find((item) => item.type === "chunk" && item.isEntry);
const styles = output
  .filter((item) => item.fileName.endsWith(".css"))
  .map((item) => `<link rel="stylesheet" href="/${item.fileName}">`)
  .join("");
const server = createServer((req, res) => {
  res.setHeader("Cache-Control", "no-store");
  // No connect-src: this test can never talk to a wallet RPC or product API.
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; connect-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:",
  );
  if (req.url === "/") {
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.end(
      `<!doctype html><html><head><meta charset="utf-8"><title>Dispute Court · isolated UI test</title>${styles}</head><body><div id="root"></div><script type="module" src="/${entry.fileName}"></script></body></html>`,
    );
  }
  const asset = output.find((item) => "/" + item.fileName === req.url);
  if (!asset) {
    res.statusCode = 404;
    return res.end();
  }
  res.setHeader(
    "Content-Type",
    asset.fileName.endsWith(".css") ? "text/css" : "text/javascript",
  );
  res.end(asset.type === "chunk" ? asset.code : asset.source);
});
server.listen(0, "127.0.0.1", () =>
  console.log(
    `Isolated UI fixture: http://127.0.0.1:${server.address().port}/`,
  ),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () => server.close(() => process.exit(0)));
