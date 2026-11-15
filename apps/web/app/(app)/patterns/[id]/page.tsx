import Link from "next/link";
import { notFound } from "next/navigation";
import { ExternalLink } from "lucide-react";
import {
  MASTERY_LABELS,
  STATUS_LABELS,
  type PatternMastery,
  type ProblemStatus,
} from "@leettrack/core";
import { patternDetail, patternName } from "@leettrack/insights";
import { PATTERN_BY_ID } from "@leettrack/seed";
import { Button } from "@leettrack/ui/components/button";
import { Difficulty, Panel } from "@leettrack/ui/components/panel";
import { TrendChart } from "@leettrack/ui/components/trend-chart";
import { MasteryBreakdown, ScoreBar } from "@/components/MasteryBreakdown";
import { StatusLabel } from "@/components/StatusLabel";
import { loadSnapshot } from "@/lib/data";
import { formatDate, formatDue, leetcodeUrl } from "@/lib/util";

const LEVEL_STATUS: Record<PatternMastery["level"], ProblemStatus> = {
  not_started: "unseen",
  learning: "in_progress",
  developing: "solved_with_help",
  proficient: "fully_solved",
  mastered: "mastered",
};

const monthLabel = (month: string) => {
  const [y, m] = month.split("-").map(Number);
  return new Date(y!, m! - 1, 1).toLocaleDateString(undefined, { month: "short" });
};

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return { title: PATTERN_BY_ID.get(id)?.name ?? "Pattern" };
}

export default async function PatternPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { snap } = await loadSnapshot();
  const d = patternDetail(snap, id);
  const known =
    PATTERN_BY_ID.has(id) || snap.settings.customPatterns?.some((c) => c.id === id) === true;
  if (!known && d.attempted.length === 0) notFound();
  const name = patternName(id, snap.settings);
  const m = d.mastery;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <Link href="/patterns" className="text-xs">
            ← All patterns
          </Link>
          <h1 className="text-xl font-semibold tracking-tight">{name}</h1>
          {m && <StatusLabel status={LEVEL_STATUS[m.level]} label={MASTERY_LABELS[m.level]} />}
        </div>
        <Button variant="secondary" asChild>
          <Link
            href={`/problems?pattern=${encodeURIComponent(id)}`}
            className="text-secondary-foreground no-underline hover:no-underline"
          >
            Open in Problems
          </Link>
        </Button>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Panel title="Score">
          {m && m.attempted > 0 ? (
            <>
              <ScoreBar value={m.mastery} label="Mastery" />
              <MasteryBreakdown m={m} />
            </>
          ) : (
            <p className="text-muted-foreground">No attempts yet, so no score.</p>
          )}
        </Panel>
        <Panel title="Cold-solve rate" description="First attempts solved alone, by month">
          <TrendChart
            title={`${name}: cold-solve rate by month`}
            points={d.trend.map((p) => ({
              label: monthLabel(p.month),
              ...(p.coldSolve !== undefined ? { value: p.coldSolve } : {}),
            }))}
            max={1}
            unit="percent"
            empty="No first attempts in the last six months."
          />
        </Panel>
        <Panel title="Time to approach" description="Median minutes to find the approach, by month">
          <TrendChart
            title={`${name}: median minutes to find the approach by month`}
            points={d.trend.map((p) => ({
              label: monthLabel(p.month),
              ...(p.medianApproachSeconds !== undefined
                ? { value: p.medianApproachSeconds / 60 }
                : {}),
            }))}
            unit="minutes"
            empty="No attempts recorded when you found the approach."
          />
        </Panel>
      </div>

      <Panel title={`Problems you've attempted (${d.attempted.length})`} id="attempted">
        {d.attempted.length === 0 ? (
          <p className="text-muted-foreground">None yet.</p>
        ) : (
          <ul className="flex flex-col">
            {d.attempted.map((r) => (
              <li
                key={r.slug}
                className="flex flex-col gap-1 rounded-md px-2 py-1.5 odd:bg-muted/40 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
              >
                <Link href={`/problems/${r.slug}`} className="min-w-0 truncate text-foreground">
                  {r.frontendId ? `${r.frontendId}. ` : ""}
                  {r.title}
                </Link>
                <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  {r.difficulty && <Difficulty value={r.difficulty} />}
                  <StatusLabel status={r.status} label={STATUS_LABELS[r.status]} />
                  {r.lastAttempted && <span>last {formatDate(r.lastAttempted)}</span>}
                  {r.nextDue && <span>review {formatDue(r.nextDue, snap.now)}</span>}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel
        title={`Not started yet (${d.unstarted.length})`}
        id="unstarted"
        description="Problems in your active lists suggested for this pattern. Knowing the pattern is a hint, so they stay hidden until you ask."
      >
        {d.unstarted.length === 0 ? (
          <p className="text-muted-foreground">None left in your active lists.</p>
        ) : (
          <details>
            <summary className="cursor-pointer text-xs text-link">Show unstarted problems</summary>
            <ul className="mt-2 flex flex-col">
              {d.unstarted.map((p) => (
                <li
                  key={p.slug}
                  className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 odd:bg-muted/40"
                >
                  <Link href={`/problems/${p.slug}`} className="min-w-0 truncate text-foreground">
                    {p.frontendId ? `${p.frontendId}. ` : ""}
                    {p.title}
                  </Link>
                  <span className="flex items-center gap-3">
                    {p.difficulty && <Difficulty value={p.difficulty} />}
                    <a
                      className="inline-flex items-center gap-1 text-xs"
                      href={leetcodeUrl(p.slug)}
                      target="_blank"
                      rel="noreferrer"
                    >
                      Solve <ExternalLink className="size-3" aria-hidden />
                    </a>
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </Panel>
    </>
  );
}
