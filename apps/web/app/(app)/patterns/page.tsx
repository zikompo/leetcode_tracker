import Link from "next/link";
import {
  MASTERY_LABELS,
  STATUS_LABELS,
  type PatternMastery,
  type ProblemStatus,
} from "@leettrack/core";
import { masteryFrom, patternName, problemRows } from "@leettrack/insights";
import { Panel } from "@leettrack/ui/components/panel";
import { PageHead } from "@/components/PageHead";
import { StatusLabel } from "@/components/StatusLabel";
import { loadSnapshot } from "@/lib/data";
import { pct } from "@/lib/util";

export const metadata = { title: "Patterns" };

const LEVEL_STATUS: Record<PatternMastery["level"], ProblemStatus> = {
  not_started: "unseen",
  learning: "in_progress",
  developing: "solved_with_help",
  proficient: "fully_solved",
  mastered: "mastered",
};

function Breakdown({ m }: { m: PatternMastery }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-xs">
      <dt className="text-muted-foreground">Retention</dt>
      <dd>{pct(m.retention)} · how well you&apos;d recall what you&apos;ve solved</dd>
      <dt className="text-muted-foreground">Cold-solve</dt>
      <dd>
        {pct(m.coldSolve)} · {m.coldSolved} of {m.coldAttempts} first attempts solved alone
      </dd>
      <dt className="text-muted-foreground">Coverage</dt>
      <dd>
        {m.coverage === undefined
          ? "not in your active lists"
          : `${pct(m.coverage)} of ${m.listTotal} list problems`}
      </dd>
    </dl>
  );
}

export default async function PatternsPage() {
  const { snap } = await loadSnapshot();
  const mastery = masteryFrom(snap);
  const rows = problemRows(snap);
  const name = (id: string) => patternName(id, snap.settings);
  const started = mastery.filter((m) => m.attempted > 0).sort((a, b) => b.mastery - a.mastery);
  const notStarted = mastery
    .filter((m) => m.attempted === 0)
    .sort((a, b) => name(a.pattern).localeCompare(name(b.pattern)));

  return (
    <>
      <PageHead title="Patterns">
        Mastery = 50% retention + 30% cold-solve + 20% coverage of your active lists.
      </PageHead>
      {started.length === 0 && (
        <p className="text-muted-foreground">No attempts yet, so no pattern scores.</p>
      )}
      <div className="grid items-start gap-4 md:grid-cols-2 lg:grid-cols-3">
        {started.map((m) => {
          const problems = rows.filter((r) => r.attempts > 0 && r.patterns.includes(m.pattern));
          return (
            <section
              key={m.pattern}
              id={m.pattern}
              data-slot="pattern"
              className="flex scroll-mt-20 flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10"
              aria-label={name(m.pattern)}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-medium">{name(m.pattern)}</h3>
                <StatusLabel status={LEVEL_STATUS[m.level]} label={MASTERY_LABELS[m.level]} />
              </div>
              <div className="flex items-center gap-3">
                <div
                  className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
                  role="img"
                  aria-label={`Mastery ${pct(m.mastery)}`}
                >
                  <div
                    className="h-full rounded-full bg-primary"
                    style={{ width: pct(m.mastery) }}
                  />
                </div>
                <strong className="text-sm tabular-nums">{pct(m.mastery)}</strong>
              </div>
              <Breakdown m={m} />
              <details>
                <summary className="cursor-pointer text-xs text-link">
                  {problems.length} problem{problems.length === 1 ? "" : "s"} attempted
                </summary>
                <ul className="mt-2 flex flex-col gap-1">
                  {problems.map((p) => (
                    <li key={p.slug} className="flex items-center justify-between gap-2">
                      <Link
                        href={`/problems/${p.slug}`}
                        className="min-w-0 truncate text-foreground"
                      >
                        {p.title}
                      </Link>
                      <StatusLabel status={p.status} label={STATUS_LABELS[p.status]} />
                    </li>
                  ))}
                </ul>
              </details>
            </section>
          );
        })}
      </div>
      {notStarted.length > 0 && (
        <Panel
          title="Not started"
          description="Patterns in your active lists you haven't tried yet, with how many problems use each. Which problems isn't shown, so it doesn't give the approach away."
        >
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-2">
            {notStarted.map((m) => (
              <li
                key={m.pattern}
                data-slot="chip"
                className="flex items-center justify-between gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm"
              >
                <span>{name(m.pattern)}</span>
                {m.listTotal > 0 && (
                  <span
                    className="rounded-full bg-secondary px-2 text-xs text-muted-foreground tabular-nums"
                    title="Problems in your active lists"
                  >
                    {m.listTotal}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}
