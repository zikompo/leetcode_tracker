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
import { loadSnapshot } from "@/lib/data";
import { formatDate, formatDue, leetcodeUrl, pct } from "@/lib/util";
import { CodeDiff } from "./CodeDiff";
import { OverrideForm } from "./OverrideForm";

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
      <div className="page-head">
        <div className="stack" style={{ gap: 4 }}>
          <h1>
            {info.frontendId ? `${info.frontendId}. ` : ""}
            {info.title ?? slug}
          </h1>
          <div className="row small">
            {info.difficulty && (
              <span className={`diff-${info.difficulty}`}>{info.difficulty}</span>
            )}
            <span className={`status status-${status.status}`}>
              {STATUS_LABELS[status.status]}
              {status.optimality && status.optimality !== "unsure" ? ` · ${status.optimality}` : ""}
              {status.overridden ? " · manual" : ""}
            </span>
            {card?.isLeech && <span className="pill pill-bad">leech</span>}
          </div>
        </div>
        <a className="btn btn-primary" href={leetcodeUrl(slug)} target="_blank" rel="noreferrer">
          Open on LeetCode ↗
        </a>
      </div>

      <div className="grid">
        <section className="card" aria-labelledby="schedule">
          <h2 id="schedule">Review</h2>
          {card ? (
            <p>
              Next review <strong>{formatDue(card.due, snap.now)}</strong> ({formatDate(card.due)})
              <br />
              <span className="muted small">
                Recall now about {pct(card.retrievability)} · memory stable for ~
                {Math.round(card.stabilityDays)} days · {card.reps} reviews, {card.lapses} lapses
              </span>
            </p>
          ) : (
            <p className="muted">Not scheduled yet: log an attempt in the extension.</p>
          )}
        </section>
        <section className="card" aria-labelledby="tags">
          <h2 id="tags">Patterns and lists</h2>
          <div className="row">
            {shownPatterns.length === 0 && <span className="muted small">No patterns yet.</span>}
            {shownPatterns.map((id) => (
              <span key={id} className="pill pill-accent">
                {name(id)}
              </span>
            ))}
            {!patterns.length && shownPatterns.length > 0 && (
              <span className="muted small">(suggested)</span>
            )}
          </div>
          {(snap.problemMap.get(slug)?.leetcodeTopics.length ?? 0) > 0 && (
            <p className="muted small">
              LeetCode tags: {snap.problemMap.get(slug)!.leetcodeTopics.join(", ")}
            </p>
          )}
          {lists.length > 0 && (
            <p className="muted small">In {lists.map((l) => l.name).join(", ")}</p>
          )}
        </section>
        <section className="card" aria-labelledby="override">
          <h2 id="override">Manual status</h2>
          <OverrideForm
            slug={slug}
            {...(snap.problemMap.get(slug)?.statusOverride
              ? { current: snap.problemMap.get(slug)!.statusOverride! }
              : {})}
          />
        </section>
      </div>

      <section className="stack" aria-labelledby="attempts">
        <h2 id="attempts">Attempts ({attempts.length})</h2>
        {attempts.length === 0 ? (
          <p className="muted">No attempts logged.</p>
        ) : (
          <ol className="timeline">
            {attempts.map((a, i) => (
              <li key={a.id} className="card attempt">
                <div className="attempt-head">
                  <strong>#{attempts.length - i}</strong>
                  <span>{formatDate(a.endedAt)}</span>
                  <span>
                    {OUTCOME[a.outcome]}
                    {a.helpLevel !== "none" ? ` (${HELP[a.helpLevel]})` : ""}
                  </span>
                  <span className="pill">{RATING_LABELS[a.rating]}</span>
                  {a.kind === "quick" && <span className="pill">quick review</span>}
                  {a.isCold && <span className="pill">cold</span>}
                </div>
                <p className="muted small">
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
                    <strong>Clue:</strong> {a.patternClue}
                  </p>
                )}
                {a.stuckNote && (
                  <p>
                    <strong>Stuck on:</strong> {a.stuckNote}
                  </p>
                )}
                {a.notes && <p style={{ whiteSpace: "pre-wrap" }}>{a.notes}</p>}
                {a.code && (
                  <details>
                    <summary>Code</summary>
                    <pre className="code">{a.code}</pre>
                  </details>
                )}
              </li>
            ))}
          </ol>
        )}
      </section>

      {versions.length >= 2 && (
        <section className="card" aria-labelledby="diff">
          <h2 id="diff">Code changes between attempts</h2>
          <CodeDiff versions={versions} />
        </section>
      )}
    </>
  );
}
