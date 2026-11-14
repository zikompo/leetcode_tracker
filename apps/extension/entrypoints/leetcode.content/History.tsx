import { useState } from "react";
import {
  RATING_LABELS,
  STATUS_LABELS,
  formatComplexity,
  formatDuration,
  solveSeconds,
  type Attempt,
  type Optimality,
  type ProblemStatus,
  type StatusOverride,
} from "@leettrack/core";
import { formatDue } from "@/lib/format";
import { patternName, type PatternPrefs } from "@/lib/patterns";
import type { ProblemState } from "@/lib/types";

const OUTCOME_LABELS: Record<Attempt["outcome"], string> = {
  solved_independently: "Solved alone",
  solved_with_help: "With help",
  not_solved: "Not solved",
};

const HELP_LABELS: Record<Attempt["helpLevel"], string> = {
  none: "",
  hint: "hint",
  approach: "key idea",
  partial_code: "partial code",
  full_solution: "full solution",
};

const OVERRIDE_STATUSES: ProblemStatus[] = [
  "unseen",
  "in_progress",
  "solved_with_help",
  "fully_solved",
];

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function AttemptItem({
  attempt,
  index,
  hideNotes,
}: {
  attempt: Attempt;
  index: number;
  hideNotes: boolean;
}) {
  const checkpoints = attempt.checkpoints ?? [];
  const multi = checkpoints.length > 1;
  const hasDetails =
    multi ||
    attempt.notes ||
    attempt.stuckNote ||
    attempt.patternClue ||
    attempt.code ||
    attempt.complexityAchieved;
  return (
    <li className="lt-attempt">
      <div className="lt-attempt-head">
        <span className="lt-attempt-n">#{index}</span>
        <span>{formatDate(attempt.startedAt)}</span>
        <span className={`lt-outcome lt-outcome-${attempt.outcome}`}>
          {OUTCOME_LABELS[attempt.outcome]}
          {attempt.helpLevel !== "none" && ` (${HELP_LABELS[attempt.helpLevel]})`}
        </span>
        <span className={`lt-rating-tag lt-rating-${attempt.rating}`}>
          {RATING_LABELS[attempt.rating]}
        </span>
      </div>
      <div className="lt-attempt-meta">
        {multi
          ? `${checkpoints.length} solutions, final at ${formatDuration(solveSeconds(attempt))}`
          : formatDuration(solveSeconds(attempt))}
        {attempt.kind === "quick" && " · quick review"}
        {!hideNotes && attempt.complexityAchieved && ` · ${attempt.complexityAchieved}`}
        {` · ${attempt.submissions.length} submission${attempt.submissions.length === 1 ? "" : "s"}`}
        {attempt.optimality && attempt.optimality !== "unsure" && ` · ${attempt.optimality}`}
        {attempt.isCold && " · cold"}
        {attempt.language && ` · ${attempt.language}`}
      </div>
      {hasDetails && !hideNotes && (
        <details className="lt-details">
          <summary>Notes and code</summary>
          {multi && (
            <ol className="lt-checkpoints">
              {checkpoints.map((c, i) => (
                <li key={c.at}>
                  {formatDuration(c.activeSeconds)}
                  {i > 0 &&
                    ` (+${formatDuration(c.activeSeconds - checkpoints[i - 1]!.activeSeconds)})`}
                  {formatComplexity(c) && ` · ${formatComplexity(c)}`}
                </li>
              ))}
            </ol>
          )}
          {attempt.complexityOptimal &&
            attempt.complexityOptimal !== attempt.complexityAchieved && (
              <p>
                <strong>Optimal:</strong> {attempt.complexityOptimal}
              </p>
            )}
          {attempt.patternClue && (
            <p>
              <strong>Clue:</strong> {attempt.patternClue}
            </p>
          )}
          {attempt.stuckNote && (
            <p>
              <strong>Stuck on:</strong> {attempt.stuckNote}
            </p>
          )}
          {attempt.notes && <div className="lt-notes">{attempt.notes}</div>}
          {attempt.code && <pre className="lt-pre">{attempt.code}</pre>}
        </details>
      )}
    </li>
  );
}

function OverrideControl({
  problem,
  onOverride,
}: {
  problem: ProblemState;
  onOverride(o: StatusOverride | null): void;
}) {
  const current = problem.problem?.statusOverride;
  const [status, setStatus] = useState<ProblemStatus>(current?.status ?? "fully_solved");
  const [optimality, setOptimality] = useState<Optimality>(current?.optimality ?? "optimal");
  return (
    <div className="lt-override">
      <span className="lt-label">Manual status</span>
      <div className="lt-row lt-row-tight">
        <select
          className="lt-input"
          value={status}
          onChange={(e) => setStatus(e.target.value as ProblemStatus)}
        >
          {OVERRIDE_STATUSES.map((s) => (
            <option key={s} value={s}>
              {STATUS_LABELS[s]}
            </option>
          ))}
        </select>
        {status === "fully_solved" && (
          <select
            className="lt-input"
            value={optimality}
            onChange={(e) => setOptimality(e.target.value as Optimality)}
          >
            <option value="optimal">Optimal</option>
            <option value="suboptimal">Suboptimal</option>
          </select>
        )}
        <button
          type="button"
          className="lt-btn"
          onClick={() =>
            onOverride({
              status,
              ...(status === "fully_solved" ? { optimality } : {}),
              at: new Date().toISOString(),
            })
          }
        >
          Set
        </button>
        {current && (
          <button type="button" className="lt-btn lt-btn-ghost" onClick={() => onOverride(null)}>
            Clear
          </button>
        )}
      </div>
      <p className="lt-hint">
        For past work you solved before using LeetTrack. Overrides are shown as "manual".
      </p>
    </div>
  );
}

export function History({
  problem,
  patternPrefs,
  onOverride,
  notesHidden,
  onShowNotes,
}: {
  problem: ProblemState;
  patternPrefs: PatternPrefs;
  onOverride(o: StatusOverride | null): void;
  /** Retrieval first (spec 5.6): hide past notes, code and tags until this attempt is logged. */
  notesHidden: boolean;
  onShowNotes(): void;
}) {
  const attempts = problem.attempts;
  const patterns = problem.problem?.patterns ?? [];
  const card = problem.card;
  return (
    <div className="lt-history">
      {card && (
        <p className="lt-card-info">
          Next review <strong>{formatDue(card.due)}</strong> · recall now ~
          {Math.round(card.retrievability * 100)}%
          {card.isLeech && (
            <span
              className="lt-leech"
              title="Rated Again 3 or more times: probably one specific misunderstanding."
            >
              Leech
            </span>
          )}
        </p>
      )}
      {notesHidden && (
        <div className="lt-hidden-notes">
          <p>
            Your notes, code and tags from earlier attempts are hidden until you log this one, so
            you recall the approach yourself.
          </p>
          <button type="button" className="lt-link" onClick={onShowNotes}>
            Show my notes anyway
          </button>
        </div>
      )}
      {!notesHidden && patterns.length > 0 && (
        <div className="lt-chips lt-chips-static">
          {patterns.map((id) => (
            <span key={id} className="lt-chip">
              {patternName(id, patternPrefs)}
            </span>
          ))}
        </div>
      )}
      {attempts.length === 0 ? (
        <p className="lt-hint">No attempts logged yet.</p>
      ) : (
        <ol className="lt-attempts">
          {[...attempts].reverse().map((a, i) => (
            <AttemptItem
              key={a.id}
              attempt={a}
              index={attempts.length - i}
              hideNotes={notesHidden}
            />
          ))}
        </ol>
      )}
      <OverrideControl problem={problem} onOverride={onOverride} />
    </div>
  );
}
