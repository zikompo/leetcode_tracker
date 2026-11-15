import Link from "next/link";
import { MASTERY_LABELS, type PatternMastery, type ProblemStatus } from "@leettrack/core";
import { masteryFrom, patternName, problemRows } from "@leettrack/insights";
import { Panel } from "@leettrack/ui/components/panel";
import { MasteryBreakdown, ScoreBar } from "@/components/MasteryBreakdown";
import { PageHead } from "@/components/PageHead";
import { StatusLabel } from "@/components/StatusLabel";
import { loadSnapshot } from "@/lib/data";

export const metadata = { title: "Patterns" };

const LEVEL_STATUS: Record<PatternMastery["level"], ProblemStatus> = {
  not_started: "unseen",
  learning: "in_progress",
  developing: "solved_with_help",
  proficient: "fully_solved",
  mastered: "mastered",
};

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
              className="relative flex scroll-mt-20 flex-col gap-3 rounded-xl bg-card p-4 ring-1 ring-foreground/10 transition-colors hover:bg-accent/60 focus-within:ring-ring"
              aria-label={name(m.pattern)}
            >
              <div className="flex items-start justify-between gap-2">
                <h3 className="font-medium">
                  {/* The link covers the whole card. */}
                  <Link
                    href={`/patterns/${m.pattern}`}
                    className="text-foreground no-underline outline-none after:absolute after:inset-0 after:rounded-xl hover:no-underline"
                  >
                    {name(m.pattern)}
                  </Link>
                </h3>
                <StatusLabel status={LEVEL_STATUS[m.level]} label={MASTERY_LABELS[m.level]} />
              </div>
              <ScoreBar value={m.mastery} label="Mastery" />
              <MasteryBreakdown m={m} />
              <span className="text-xs text-link">
                {problems.length} problem{problems.length === 1 ? "" : "s"} attempted →
              </span>
            </section>
          );
        })}
      </div>
      {notStarted.length > 0 && (
        <Panel
          title="Not started"
          description="Patterns in your active lists you haven't tried yet, with how many problems use each. Open one to see its problems; they stay hidden until you ask, since the pattern is a hint."
        >
          <ul className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-2">
            {notStarted.map((m) => (
              <li key={m.pattern} data-slot="chip">
                <Link
                  href={`/patterns/${m.pattern}`}
                  className="flex items-center justify-between gap-2 rounded-lg bg-muted/60 px-3 py-2 text-sm text-foreground no-underline transition-colors hover:bg-accent hover:no-underline"
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
                </Link>
              </li>
            ))}
          </ul>
        </Panel>
      )}
    </>
  );
}
