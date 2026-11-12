import { checkUrl, InvalidTargetError } from "./network.mjs";

let browser;

try {
  const url = await checkUrl(process.argv[2], {
    allowDemo: process.env.CLEARACCESS_DEMO === "1",
  });

  const [{ chromium }, { default: AxeBuilder }] = await Promise.all([
    import("playwright"),
    import("@axe-core/playwright"),
  ]);

  browser = await chromium.launch({ headless: true });

  const context = await browser.newContext({
    serviceWorkers: "block",
    acceptDownloads: false,
  });

  await context.route("**/*", async (route) => {
    try {
      await checkUrl(route.request().url(), {
        allowDemo: process.env.CLEARACCESS_DEMO === "1",
      });

      await route.continue();
    } catch {
      await route.abort();
    }
  });

  const page = await context.newPage();

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

  const axe = await new AxeBuilder({ page }).analyze();

  const issues = axe.violations.flatMap((violation) =>
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
      needsManualReview: axe.incomplete.length,
      checkedRules: axe.passes.length,
      analyzedAt: new Date().toISOString(),
    }),
  );
} catch (error) {
  console.error(error.message || "Falha no navegador.");
  process.exitCode = error instanceof InvalidTargetError ? 2 : 1;
} finally {
  await browser?.close();
}
