import { notFound } from "next/navigation";
import {
  RATING_LABELS,
  STATUS_LABELS,
  formatDuration,
  solveSeconds,
  type Attempt,
} from "@leettrack/core";
import { allLists, patternName, problemStateFrom } from "@leettrack/insights";
import { SEED_BY_SLUG } from "@leettrack/seed";
import { ExternalLink } from "lucide-react";
import { Badge } from "@leettrack/ui/components/badge";
import { Button } from "@leettrack/ui/components/button";
import { Difficulty, Panel } from "@leettrack/ui/components/panel";
import { RatingBadge } from "@/components/RatingBadge";
import { StatusLabel } from "@/components/StatusLabel";
import { loadSnapshot } from "@/lib/data";
import { formatDate, formatDue, leetcodeUrl, pct } from "@/lib/util";
import { CodeDiff } from "./CodeDiff";
import { OverrideForm } from "./OverrideForm";
import { TwistsForm } from "./TwistsForm";

const OUTCOME: Record<Attempt["outcome"], string> = {
  solved_independently: "Solved alone",
  solved_with_help: "With help",
  not_solved: "Not solved",
};
const HELP: Record<Attempt["helpLevel"], string> = {
  none: "",
  hint: "hint",
  approach: "key idea",
  partial_code: "partial code",
  full_solution: "full solution",
};

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return { title: SEED_BY_SLUG.get(slug)?.title ?? slug };
}

export default async function ProblemPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { snap } = await loadSnapshot();
  const state = problemStateFrom(snap, slug);
  const info = snap.info(slug);
  if (!info.title && state.attempts.length === 0) notFound();
  const name = (id: string) => patternName(id, snap.settings);
  const { patterns, suggestedPatterns } = snap.patternsOf(slug);
  const shownPatterns = patterns.length ? patterns : state.attempts.length ? suggestedPatterns : [];
  const lists = allLists(snap).filter((l) => l.slugs.includes(slug));
  const attempts = [...state.attempts].reverse();
  const versions = state.attempts
    .filter((a) => a.code)
    .map((a, i) => ({
      id: a.id,
      label: `#${i + 1} · ${formatDate(a.endedAt)} · ${OUTCOME[a.outcome]}`,
      code: a.code!,
    }));
  const { status, card } = state;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          <h1 className="text-xl font-semibold tracking-tight">
            {info.frontendId ? `${info.frontendId}. ` : ""}
            {info.title ?? slug}
          </h1>
          <div className="flex flex-wrap items-center gap-2">
            {info.difficulty && (
              <Badge variant="secondary">
                <Difficulty value={info.difficulty} />
              </Badge>
            )}
            <StatusLabel
              status={status.status}
              label={`${STATUS_LABELS[status.status]}${
                status.optimality && status.optimality !== "unsure" ? ` · ${status.optimality}` : ""
              }${status.overridden ? " · manual" : ""}`}
            />
            {card?.isLeech && <Badge variant="destructive">leech</Badge>}
          </div>
        </div>
        <Button asChild>
          <a
            href={leetcodeUrl(slug)}
            target="_blank"
            rel="noreferrer"
            className="no-underline hover:no-underline"
          >
            Open on LeetCode <ExternalLink aria-hidden />
          </a>
        </Button>
      </div>

      <div className="grid items-start gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Panel title="Review">
          {card ? (
            <div className="flex flex-col gap-1">
              <p>
                Next review <strong>{formatDue(card.due, snap.now)}</strong>{" "}
                <span className="text-muted-foreground">({formatDate(card.due)})</span>
                {card.forTarget && (
                  <span className="text-muted-foreground">
                    {" "}
                    · brought forward for {card.forTarget}
                  </span>
                )}
              </p>
              <p className="text-xs text-muted-foreground">
                Recall now about {pct(card.retrievability)} · memory stable for ~
                {Math.round(card.stabilityDays)} days · {card.reps} reviews, {card.lapses} lapses
              </p>
            </div>
          ) : (
            <p className="text-muted-foreground">
              Not scheduled yet: log an attempt in the extension.
            </p>
          )}
        </Panel>
        <Panel title="Patterns and lists">
          <div className="flex flex-wrap items-center gap-1.5">
            {shownPatterns.length === 0 && (
              <span className="text-xs text-muted-foreground">No patterns yet.</span>
            )}
            {shownPatterns.map((id) => (
              <Badge key={id} variant="secondary">
                {name(id)}
              </Badge>
            ))}
            {!patterns.length && shownPatterns.length > 0 && (
              <span className="text-xs text-muted-foreground">(suggested)</span>
            )}
          </div>
          {(snap.problemMap.get(slug)?.leetcodeTopics.length ?? 0) > 0 && (
            <p className="text-xs text-muted-foreground">
              LeetCode tags: {snap.problemMap.get(slug)!.leetcodeTopics.join(", ")}
            </p>
          )}
          {lists.length > 0 && (
            <p className="text-xs text-muted-foreground">
              In {lists.map((l) => l.name).join(", ")}
            </p>
          )}
        </Panel>
        <Panel title="Twists" description="How would your solution change if…?">
          <TwistsForm slug={slug} twists={snap.problemMap.get(slug)?.twists ?? []} />
        </Panel>
        <Panel title="Manual status">
          <OverrideForm
            slug={slug}
            {...(snap.problemMap.get(slug)?.statusOverride
              ? { current: snap.problemMap.get(slug)!.statusOverride! }
              : {})}
          />
        </Panel>
      </div>

      <section className="flex flex-col gap-3" aria-labelledby="attempts">
        <h2 id="attempts" className="text-sm font-medium">
          Attempts ({attempts.length})
        </h2>
        {attempts.length === 0 ? (
          <p className="text-muted-foreground">No attempts logged.</p>
        ) : (
          <ol className="flex flex-col gap-3" data-slot="timeline">
            {attempts.map((a, i) => (
              <li
                key={a.id}
                className="flex flex-col gap-2 rounded-xl bg-card p-4 ring-1 ring-foreground/10"
              >
                <div className="flex flex-wrap items-center gap-2">
                  <strong className="tabular-nums">#{attempts.length - i}</strong>
                  <span className="text-muted-foreground">{formatDate(a.endedAt)}</span>
                  <span>
                    {OUTCOME[a.outcome]}
                    {a.helpLevel !== "none" ? ` (${HELP[a.helpLevel]})` : ""}
                  </span>
                  <RatingBadge rating={a.rating} label={RATING_LABELS[a.rating]} />
                  {a.kind === "quick" && <Badge variant="outline">quick review</Badge>}
                  {a.isCold && <Badge variant="outline">cold</Badge>}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatDuration(solveSeconds(a))}
                  {a.checkpoints && a.checkpoints.length > 1
                    ? ` · ${a.checkpoints.length} solutions`
                    : ""}
                  {a.complexityAchieved ? ` · ${a.complexityAchieved}` : ""}
                  {a.optimality && a.optimality !== "unsure" ? ` · ${a.optimality}` : ""}
                  {a.language ? ` · ${a.language}` : ""}
                </p>
                {a.patternClue && (
                  <p>
                    <span className="text-muted-foreground">Clue:</span> {a.patternClue}
                  </p>
                )}
                {a.stuckNote && (
                  <p>
                    <span className="text-muted-foreground">Stuck on:</span> {a.stuckNote}
                  </p>
                )}
                {a.twistAnswer && (
                  <p>
                    <span className="text-muted-foreground">Twist answer:</span> {a.twistAnswer}
                  </p>
                )}
                {a.notes && <p className="whitespace-pre-wrap">{a.notes}</p>}
                {a.code && (
                  <details className="group">
                    <summary className="cursor-pointer text-xs text-link">Code</summary>
                    <pre className="mt-2 overflow-x-auto rounded-lg bg-muted p-3 text-xs leading-relaxed">
                      {a.code}
                    </pre>
                  </details>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      {versions.length >= 2 && (
        <Panel title="Code changes between attempts">
          <CodeDiff versions={versions} />
        </Panel>
      )}
    </>
  );
}
