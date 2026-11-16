import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

const run = promisify(execFile);
const script = fileURLToPath(new URL("../analyze.mjs", import.meta.url));

test("a demonstração expõe falhas conhecidas e a versão corrigida passa", async () => {
  const analyze = async (path) => {
    const { stdout } = await run(process.execPath, [script, `http://localhost:5173/demo/${path}.html`], {
      env: { ...process.env, CLEARACCESS_DEMO: "1" }, timeout: 60000,
    });
    return JSON.parse(stdout);
  };
  const broken = await analyze("broken");
  const fixed = await analyze("fixed");
  const rules = new Set(broken.issues.map(({ ruleId }) => ruleId));
  for (const rule of ["button-name", "color-contrast", "html-has-lang", "image-alt"]) {
    assert.ok(rules.has(rule), `Regra ausente: ${rule}`);
  }
  assert.deepEqual(fixed.issues, []);
});
