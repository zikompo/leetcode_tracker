import { STATUS_LABELS } from "@leettrack/core";
import { allLists, patternName, problemRows } from "@leettrack/insights";
import { PageHead } from "@/components/PageHead";
import { loadSnapshot } from "@/lib/data";
import { formatDate, formatDue } from "@/lib/util";
import { ProblemsTable, type Row } from "./ProblemsTable";

export const metadata = { title: "Problems" };

const OUTCOME: Record<string, string> = {
  solved_independently: "Solved alone",
  solved_with_help: "With help",
  not_solved: "Not solved",
};

export default async function ProblemsPage({
  searchParams,
}: {
  searchParams: Promise<{ pattern?: string }>;
}) {
  const { pattern } = await searchParams;
  const { snap } = await loadSnapshot();
  const listNames = Object.fromEntries(allLists(snap).map((l) => [l.id, l.name]));
  // Dates are formatted here so the client renders exactly what the server did.
  const rows: Row[] = problemRows(snap).map((r) => ({
    slug: r.slug,
    title: r.title,
    number: r.frontendId ? Number(r.frontendId) : null,
    difficulty: r.difficulty ?? null,
    status: r.status,
    statusLabel: STATUS_LABELS[r.status],
    patterns: r.patterns.map((id) => ({ id, name: patternName(id, snap.settings) })),
    lists: r.lists.map((id) => ({ id, name: listNames[id] ?? id })),
    attempts: r.attempts,
    lastAttempted: r.lastAttempted ?? null,
    lastAttemptedLabel: r.lastAttempted ? formatDate(r.lastAttempted) : "",
    nextDue: r.nextDue ?? null,
    nextDueLabel: r.nextDue ? formatDue(r.nextDue, snap.now) : "",
    best: r.bestOutcome ? OUTCOME[r.bestOutcome]! : "",
    isLeech: r.isLeech,
  }));
  return (
    <>
      <PageHead title="Problems">
        Everything you&apos;ve attempted, plus your active lists.
      </PageHead>
      <ProblemsTable rows={rows} initialPattern={pattern ?? ""} />
    </>
  );
}
