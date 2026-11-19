import test from "node:test";
import assert from "node:assert/strict";

const api = process.env.CLEARACCESS_API_URL ?? "http://localhost:8080";
const ui = process.env.CLEARACCESS_UI_URL ?? "http://127.0.0.1:5173";
const demo = "http://localhost:5173/demo";

async function json(path, options) {
  const response = await fetch(`${api}${path}`, options);
  const body = await response.json();
  assert.ok(response.ok, `${path}: HTTP ${response.status} ${JSON.stringify(body)}`);
  return { response, body };
}

async function analyze(path) {
  const result = await json("/api/analyses", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: `${demo}/${path}.html` }),
  });
  assert.equal(result.response.status, 201);
  assert.equal(result.response.headers.get("location"), `/api/analyses/${result.body.id}`);
  return result.body;
}

test("integra interface, API, worker e persistência com as páginas de demonstração", { timeout: 120000 }, async () => {
  assert.equal((await json("/api/health")).body.status, "UP");
  assert.equal((await fetch(ui)).status, 200);

  const first = await analyze("broken");
  const fixed = await analyze("fixed");
  const second = await analyze("broken");
  const rules = new Set(first.issues.map((issue) => issue.ruleId));
  for (const rule of ["button-name", "color-contrast", "html-has-lang", "image-alt"]) {
    assert.ok(rules.has(rule), `Regra ausente: ${rule}`);
  }
  assert.deepEqual(fixed.issues, []);
  assert.equal((await json(`/api/analyses/${second.id}`)).body.id, second.id);
  assert.equal((await json(`/api/analyses/${second.id}/previous`)).body.id, first.id);
  const timeline = (await json(`/api/analyses/${second.id}/timeline`)).body;
  assert.deepEqual(timeline.slice(0, 2).map((item) => item.id), [second.id, first.id]);
  const history = (await json("/api/analyses/history?q=broken&page=0")).body;
  assert.ok(history.items.some((item) => item.id === second.id));
});
