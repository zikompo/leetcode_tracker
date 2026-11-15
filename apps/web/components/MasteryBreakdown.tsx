import type { PatternMastery } from "@leettrack/core";
import { pct } from "@/lib/util";

/** The three parts of a pattern's mastery score (spec 6). */
export function MasteryBreakdown({ m }: { m: PatternMastery }) {
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

/** A thin bar for a 0–1 score, with its percentage. */
export function ScoreBar({ value, label }: { value: number; label: string }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`${label} ${pct(value)}`}
      >
        <div className="h-full rounded-full bg-primary" style={{ width: pct(value) }} />
      </div>
      <strong className="text-sm tabular-nums">{pct(value)}</strong>
    </div>
  );
}
