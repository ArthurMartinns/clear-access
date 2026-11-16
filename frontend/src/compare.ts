export type ComparableIssue = { ruleId: string; selector: string };

export function compareIssues<T extends ComparableIssue>(
  current: T[],
  previous: T[],
) {
  const remaining = new Map<string, number>();
  for (const issue of previous) {
    const key = JSON.stringify([issue.ruleId, issue.selector]);
    remaining.set(key, (remaining.get(key) ?? 0) + 1);
  }

  const added: T[] = [];
  let unchanged = 0;
  for (const issue of current) {
    const key = JSON.stringify([issue.ruleId, issue.selector]);
    const count = remaining.get(key) ?? 0;
    if (count) {
      remaining.set(key, count - 1);
      unchanged++;
    } else {
      added.push(issue);
    }
  }

  const resolved = previous.length - unchanged;
  return { added, resolved, unchanged };
}
