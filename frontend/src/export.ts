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
  const escape = (value: string) => {
    const safe = /^[\s]*[=+\-@]/.test(value) ? `'${value}` : value;
    return `"${safe.replaceAll('"', '""')}"`;
  };
  return (
    "\uFEFF" +
    [
      columns.join(","),
      ...issues.map((issue) =>
        columns.map((column) => escape(issue[column] ?? "")).join(","),
      ),
    ].join("\r\n") +
    "\r\n"
  );
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
