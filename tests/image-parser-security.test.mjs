import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";

const dependency = createRequire(import.meta.resolve("vinext")).resolve(
  "image-size",
);

// Run malformed fixtures in a disposable process: a missing regression patch
// must fail the test by timeout, not hang the entire test runner.
for (const extension of ["cjs", "mjs"]) {
  test(
    "patched image parser rejects non-progressing ICNS, HEIF and JXL boxes (" +
      extension +
      ")",
    () => {
      const script = `
      import assert from "node:assert/strict";
      import { pathToFileURL } from "node:url";
      import { dirname, join } from "node:path";
      const path = process.argv[1], extension = process.argv[2];
      const { imageSize } = await import(pathToFileURL(path).href);
      const integer = n => {const value = Buffer.alloc(4);value.writeUInt32BE(n);return value;};
      const box = (name, size, data = Buffer.alloc(0)) => Buffer.concat([integer(size), Buffer.from(name), data]);
      for (const size of [0, 1, 7]) {
        const icon = Buffer.concat([Buffer.from("icns"), integer(16), Buffer.from("is32"), integer(size)]);
        const heif = Buffer.concat([
          box("ftyp",16,Buffer.from([97,118,105,102,0,0,0,0])),
          box("meta",36,Buffer.alloc(4)),box("iprp",8),box("ipco",20),
          box("ispe",size,Buffer.alloc(16))
        ]);
        const jxl = Buffer.concat([
          box("JXL ",12,Buffer.from([13,10,135,10])),
          box("ftyp",16,Buffer.from([106,120,108,32,0,0,0,0])),
          box("jxlp",size,Buffer.alloc(4))
        ]);
        for (const input of [icon, heif, jxl]) assert.throws(() => imageSize(input));
        for (const [name, exported, input] of [["icns","ICNS",icon],["heif","HEIF",heif],["jxl","JXL",jxl]]) {
          const module = await import(pathToFileURL(join(dirname(path),"types",name+"."+extension)).href);
          assert.throws(() => module[exported].calculate(input));
        }
      }
      const validIcon = Buffer.concat([Buffer.from("icns"), integer(16), Buffer.from("is32"), integer(8)]);
      assert.equal(imageSize(validIcon).width,16);
      const png = Buffer.alloc(24);
      Buffer.from([137,80,78,71,13,10,26,10]).copy(png);
      png.writeUInt32BE(13,8);png.write("IHDR",12);png.writeUInt32BE(3,16);png.writeUInt32BE(2,20);
      const dimensions = imageSize(png);
      assert.equal(dimensions.width,3);assert.equal(dimensions.height,2);
    `;
      const result = spawnSync(
        process.execPath,
        [
          "--input-type=module",
          "-e",
          script,
          join(dirname(dependency), "index." + extension),
          extension,
        ],
        {
          encoding: "utf8",
          timeout: 10000,
          maxBuffer: 32768,
        },
      );
      assert.equal(result.error, undefined, result.error?.message);
      assert.equal(result.status, 0, result.stderr || result.stdout);
    },
  );
}
