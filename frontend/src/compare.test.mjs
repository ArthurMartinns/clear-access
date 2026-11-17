import test from "node:test";
import assert from "node:assert/strict";
import { compareIssues } from "./compare.ts";

test("separa ocorrências novas, resolvidas e persistentes", () => {
  const oldIssues = [
    { ruleId: "image-alt", selector: "img.hero" },
    { ruleId: "label", selector: "input#email" },
  ];
  const nextIssues = [
    { ruleId: "image-alt", selector: "img.hero" },
    { ruleId: "color-contrast", selector: "p.caption" },
  ];
  const result = compareIssues(nextIssues, oldIssues);
  assert.equal(result.unchanged, 1);
  assert.equal(result.resolved, 1);
  assert.deepEqual(result.added, [nextIssues[1]]);
  assert.deepEqual(result.resolvedIssues, [oldIssues[1]]);
});

test("conta seletores repetidos sem confundir ocorrências", () => {
  const issue = { ruleId: "label", selector: "input" };
  assert.deepEqual(compareIssues([issue], [issue, issue]), {
    added: [], resolved: 1, resolvedIssues: [issue], unchanged: 1,
  });
});
