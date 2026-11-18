import { checkUrl, InvalidTargetError } from "./network.mjs";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { RequestBudget } from "./request-budget.mjs";

let browser;

try {
  const url = await checkUrl(process.argv[2], {
    allowDemo: process.env.CLEARACCESS_DEMO === "1",
  });

  const [{ chromium }, { default: AxeBuilder }, { default: axe }] =
    await Promise.all([
      import("playwright"),
      import("@axe-core/playwright"),
      import("axe-core"),
    ]);
  const require = createRequire(import.meta.url);
  const locale = JSON.parse(
    readFileSync(require.resolve("axe-core/locales/pt_BR.json"), "utf8"),
  );

  browser = await chromium.launch({ headless: true });

  const context = await browser.newContext({
    serviceWorkers: "block",
    acceptDownloads: false,
  });

  const requestBudget = new RequestBudget();

  await context.route("**/*", async (route) => {
    try {
      if (!requestBudget.consume()) {
        await route.abort();
        return;
      }
      await checkUrl(route.request().url(), {
        allowDemo: process.env.CLEARACCESS_DEMO === "1",
      });

      await route.continue();
    } catch {
      await route.abort();
    }
  });

  const page = await context.newPage();
  page.on("dialog", (dialog) => void dialog.dismiss());

  page.setDefaultTimeout(15000);

  const response = await page.goto(url, {
    waitUntil: "domcontentloaded",
    timeout: 20000,
  });

  if (!response || response.status() >= 400) {
    throw new Error(
      `Página indisponível (HTTP ${response?.status() ?? "sem resposta"}).`,
    );
  }

  await checkUrl(page.url(), {
    allowDemo: process.env.CLEARACCESS_DEMO === "1",
  });

  const results = await new AxeBuilder({
    page,
    axeSource: `${axe.source}\naxe.configure({ locale: ${JSON.stringify(locale)} });`,
  }).analyze();

  if (requestBudget.exceeded) {
    throw new Error("A página excedeu o limite de 500 requisições.");
  }

  const issues = results.violations.flatMap((violation) =>
    violation.nodes.map((node) => ({
      ruleId: violation.id,
      impact: violation.impact ?? "moderate",
      category:
        violation.tags.find((tag) => tag.startsWith("cat."))?.slice(4) ??
        "geral",
      title: violation.help,
      description: violation.description,
      helpUrl: violation.helpUrl,
      selector: node.target.join(" "),
      element: node.html.slice(0, 300),
      why: node.failureSummary ?? "",
      howToFix: node.any
        .concat(node.all)
        .map((check) => check.message)
        .filter(Boolean)
        .join(" "),
    })),
  );

  console.log(
    JSON.stringify({
      url: page.url(),
      title: await page.title(),
      issues,
      needsManualReview: results.incomplete.length,
      checkedRules: results.passes.length,
      analyzedAt: new Date().toISOString(),
    }),
  );
} catch (error) {
  console.error(error.message || "Falha no navegador.");
  process.exitCode = error instanceof InvalidTargetError ? 2 : 1;
} finally {
  await browser?.close();
}
