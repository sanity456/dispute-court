import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

const schema = JSON.parse(
  readFileSync(new URL("../lib/contract-schema.json", import.meta.url), "utf8"),
);
const deployment = JSON.parse(
  readFileSync(new URL("../lib/deployment.json", import.meta.url), "utf8"),
);
const files = ["../components/ProductHome.tsx", "../lib/useProtocol.ts"];

function literals(node) {
  if (ts.isStringLiteral(node)) return [node.text];
  if (ts.isConditionalExpression(node))
    return [...literals(node.whenTrue), ...literals(node.whenFalse)];
  return [];
}

test("every UI transaction calls an actual deployed write method", () => {
  const called = new Set();
  for (const file of files) {
    const source = ts.createSourceFile(
      file,
      readFileSync(new URL(file, import.meta.url), "utf8"),
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX,
    );
    function visit(node) {
      if (
        ts.isCallExpression(node) &&
        ts.isIdentifier(node.expression) &&
        node.expression.text === "transact"
      ) {
        const methods = literals(node.arguments[1]);
        assert.ok(
          methods.length,
          "UI write methods must be statically identifiable",
        );
        for (const method of methods) {
          called.add(method);
          assert.ok(
            schema.methods[method],
            "Unknown deployed method: " + method,
          );
          assert.equal(schema.methods[method].readonly, false);
          if (
            node.arguments[2] &&
            ts.isArrayLiteralExpression(node.arguments[2]) &&
            !node.arguments[2].elements.some(ts.isSpreadElement)
          ) {
            assert.equal(
              node.arguments[2].elements.length,
              schema.methods[method].params.length,
              method + " argument count",
            );
          }
        }
      }
      ts.forEachChild(node, visit);
    }
    visit(source);
  }
  const allWrites = Object.entries(schema.methods)
    .filter(([, info]) => !info.readonly)
    .map(([method]) => method);
  for (const method of allWrites)
    assert.ok(called.has(method), "Missing UI workflow: " + method);
});

test("deployment is explicit Studionet with a valid address and transaction", () => {
  assert.equal(deployment.chainId, 61999);
  assert.equal(deployment.network, "studionet");
  assert.match(deployment.contractAddress, /^0x[0-9a-fA-F]{40}$/);
  assert.match(deployment.deploymentTransaction, /^0x[0-9a-fA-F]{64}$/);
  assert.notEqual(
    deployment.contractAddress.toLowerCase(),
    "0x" + "0".repeat(40),
  );
});
