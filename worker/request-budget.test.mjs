import test from "node:test";
import assert from "node:assert/strict";
import { RequestBudget } from "./request-budget.mjs";

test("interrompe recursos depois do limite de requisições", () => {
  const budget = new RequestBudget(2);
  assert.equal(budget.consume(), true);
  assert.equal(budget.consume(), true);
  assert.equal(budget.consume(), false);
  assert.equal(budget.exceeded, true);
});
