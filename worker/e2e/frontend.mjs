import test from "node:test";
import assert from "node:assert/strict";
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";

const baseUrl = process.env.CLEARACCESS_UI_URL ?? "http://localhost:5173";
const oldId = "11111111-1111-4111-8111-111111111111";
const newId = "22222222-2222-4222-8222-222222222222";
const issue = (ruleId, selector) => ({
  ruleId, selector, impact: "serious", category: "forms", title: ruleId,
  description: "Descrição", helpUrl: "https://example.com/rule",
  element: `<div class="${selector}"></div>`, why: "Motivo", howToFix: "Correção",
});
const previous = {
  id: oldId, url: "https://example.com/", title: "Página de exemplo",
  analyzedAt: "2026-11-10T13:00:00Z", checkedRules: 20, needsManualReview: 0,
  issues: [issue("image-alt", "img.hero"), issue("label", "input.email")],
};
const current = {
  ...previous, id: newId, analyzedAt: "2026-11-11T13:00:00Z",
  issues: [issue("image-alt", "img.hero"), issue("color-contrast", "p.caption")],
};
const summaries = [current, previous].map(({ id, url, title, analyzedAt, issues, needsManualReview, checkedRules }) => ({
  id, url, title, analyzedAt, issueCount: issues.length, needsManualReview, checkedRules,
}));

test("abre histórico, compara relatórios e respeita navegação do navegador", async (t) => {
  const browser = await chromium.launch({ headless: true });
  t.after(() => browser.close());
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  const page = await context.newPage();
  await page.route("**/api/analyses**", async (route) => {
    const requestUrl = new URL(route.request().url());
    const path = requestUrl.pathname;
    let body;
    if (path === "/api/analyses/history") {
      const q = requestUrl.searchParams.get("q")?.toLowerCase() ?? "";
      const issues = requestUrl.searchParams.get("issues") ?? "all";
      const sort = requestUrl.searchParams.get("sort") ?? "recent";
      const items = summaries.filter((item) => `${item.title} ${item.url}`.toLowerCase().includes(q))
        .filter((item) => issues === "all" || (issues === "with" ? item.issueCount > 0 : item.issueCount === 0))
        .filter((item) => !requestUrl.searchParams.get("from") || item.analyzedAt.slice(0, 10) >= requestUrl.searchParams.get("from"))
        .filter((item) => !requestUrl.searchParams.get("to") || item.analyzedAt.slice(0, 10) <= requestUrl.searchParams.get("to"))
        .sort((a, b) => sort === "oldest" ? a.analyzedAt.localeCompare(b.analyzedAt)
          : sort === "fewest" ? a.issueCount - b.issueCount
          : sort === "most" ? b.issueCount - a.issueCount
          : b.analyzedAt.localeCompare(a.analyzedAt));
      body = { items, page: Number(requestUrl.searchParams.get("page") ?? 0), size: 20, total: items.length };
    }
    else if (path === "/api/analyses") body = summaries;
    else if (path === `/api/analyses/${newId}/previous`) body = previous;
    else if (path === `/api/analyses/${newId}/timeline`) body = summaries;
    else if (path === `/api/analyses/${oldId}/timeline`) body = [summaries[1]];
    else if (path === `/api/analyses/${oldId}/previous`) {
      await route.fulfill({ status: 204 });
      return;
    } else if (path === `/api/analyses/${newId}`) body = current;
    else if (path === `/api/analyses/${oldId}`) body = previous;
    else throw new Error(`Rota inesperada: ${path}`);
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
  });

  await page.goto(baseUrl);
  await page.getByLabel("Buscar no histórico").fill("não existe");
  await page.getByText("Nenhuma análise corresponde aos filtros.").waitFor();
  await page.getByLabel("Buscar no histórico").fill("");
  await page.locator(".history-item").first().waitFor();
  await page.locator(".history-controls select").first().selectOption("without");
  await page.getByText("Nenhuma análise corresponde aos filtros.").waitFor();
  await page.getByRole("button", { name: "Limpar filtros" }).click();
  await page.locator(".history-item").first().getByText(/11 de nov/).waitFor();
  await page.getByLabel("Ordenar por").selectOption("oldest");
  await page.locator(".history-item").first().getByText(/10 de nov/).waitFor();
  await page.getByRole("button", { name: "Limpar filtros" }).click();
  await page.locator(".history-item").first().getByText(/11 de nov/).waitFor();
  if (process.env.CLEARACCESS_VISUAL_OUTPUT) {
    await page.locator(".history-item").first().waitFor();
    await page.screenshot({ path: `${process.env.CLEARACCESS_VISUAL_OUTPUT}/first-run-desktop.png`, fullPage: true });
  }
  await page.locator(".history-item").first().click();
  await page.getByText("novas ocorrências", { exact: true }).waitFor();
  assert.equal(await page.locator(".comparison-values strong").allTextContents().then((values) => values.join(",")), "1,1,1");
  assert.equal(await page.getByText("Ocorrências resolvidas").count(), 1);
  assert.equal(await page.locator(".timeline-list li").count(), 2);
  const comparisonDownload = page.waitForEvent("download");
  await page.getByRole("button", { name: "Baixar comparação" }).click();
  assert.match((await comparisonDownload).suggestedFilename(), /clearaccess-comparacao-.*\.csv/);
  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Baixar CSV" }).click();
  assert.match((await downloadPromise).suggestedFilename(), /clearaccess-.*\.csv/);
  assert.equal(new URL(page.url()).searchParams.get("analysis"), newId);
  const audit = await new AxeBuilder({ page }).analyze();
  assert.deepEqual(audit.violations.map(({ id }) => id), []);

  if (process.env.CLEARACCESS_VISUAL_OUTPUT) {
    await page.screenshot({ path: `${process.env.CLEARACCESS_VISUAL_OUTPUT}/report-desktop.png`, fullPage: true });
    await page.setViewportSize({ width: 768, height: 900 });
    await page.screenshot({ path: `${process.env.CLEARACCESS_VISUAL_OUTPUT}/report-tablet.png`, fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    await page.screenshot({ path: `${process.env.CLEARACCESS_VISUAL_OUTPUT}/report-mobile.png`, fullPage: true });
  }

  await page.getByRole("button", { name: "Abrir anterior" }).click();
  await page.getByText("Esta é a primeira análise salva deste endereço.").waitFor();
  assert.equal(new URL(page.url()).searchParams.get("analysis"), oldId);
  await page.goBack();
  await page.getByText("novas ocorrências", { exact: true }).waitFor();
  assert.equal(new URL(page.url()).searchParams.get("analysis"), newId);
  await page.reload();
  await page.getByText("novas ocorrências", { exact: true }).waitFor();
  assert.equal(await page.locator(".comparison-values strong").allTextContents().then((values) => values.join(",")), "1,1,1");
});
