export type ExportIssue = {
  impact: string;
  ruleId: string;
  title: string;
  category: string;
  selector: string;
  why: string;
  howToFix: string;
  helpUrl: string;
};

function escapeCsv(value: string): string {
  const safe = /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safe.replaceAll('"', '""')}"`;
}

export function issuesCsv(issues: ExportIssue[]): string {
  const columns: (keyof ExportIssue)[] = [
    "impact",
    "ruleId",
    "title",
    "category",
    "selector",
    "why",
    "howToFix",
    "helpUrl",
  ];
  return (
    "\uFEFF" +
    [
      columns.join(","),
      ...issues.map((issue) =>
        columns.map((column) => escapeCsv(issue[column] ?? "")).join(","),
      ),
    ].join("\r\n") +
    "\r\n"
  );
}

export function comparisonCsv(added: ExportIssue[], resolved: ExportIssue[]): string {
  const rows: Array<[string, ExportIssue]> = [
    ...added.map((issue): [string, ExportIssue] => ["nova", issue]),
    ...resolved.map((issue): [string, ExportIssue] => ["resolvida", issue]),
  ];
  return "\uFEFFestado,impacto,regra,título,seletor\r\n" + rows.map(([status, issue]) =>
    [status, issue.impact, issue.ruleId, issue.title, issue.selector]
      .map(escapeCsv).join(","),
  ).join("\r\n") + (rows.length ? "\r\n" : "");
}

export function downloadReport(
  contents: string,
  filename: string,
  type: string,
) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
