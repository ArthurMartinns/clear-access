import test from "node:test";
import assert from "node:assert/strict";
import { issuesCsv } from "./export.ts";

test("exporta CSV com BOM, aspas e quebras de linha", () => {
  const csv = issuesCsv([
    {
      impact: "serious",
      ruleId: "label",
      title: 'Campo "nome"',
      category: "forms",
      selector: "input.name",
      why: "linha 1\nlinha 2",
      howToFix: "Adicionar rótulo",
      helpUrl: "https://example.com/",
    },
  ]);
  assert.ok(csv.startsWith("\uFEFFimpact,ruleId"));
  assert.ok(csv.includes('"Campo ""nome"""'));
  assert.ok(csv.includes('"linha 1\nlinha 2"'));
});

test("neutraliza fórmulas em valores vindos da página analisada", () => {
  const csv = issuesCsv([
    {
      impact: "serious",
      ruleId: "label",
      title: "=1+1",
      category: "forms",
      selector: " @SUM(1)",
      why: "",
      howToFix: "",
      helpUrl: "",
    },
  ]);
  assert.ok(csv.includes('"\'=1+1"'));
  assert.ok(csv.includes('"\' @SUM(1)"'));
});
