import { useEffect, useRef, useState } from "react";
import {
  RATING_LABELS,
  formatDuration,
  HINT_LADDER,
  solveSeconds,
  suggestHelpLevel,
  timeboxRung,
  suggestRating,
  validateDraft,
  type AttemptDraft,
  type Complexity,
  type HelpLevel,
  type Optimality,
  type Outcome,
  type Rating,
} from "@leettrack/core";
import { ComplexityPicker } from "./ComplexityPicker";
import { TagInput } from "./TagInput";
import type { AiStatus } from "@/lib/ai";
import { patternName, resolvedSuggestions, type PatternPrefs } from "@/lib/patterns";
import type { AttemptSession, ProblemState, SessionCheckpoint } from "@/lib/types";

const OUTCOMES: Array<[Outcome, string]> = [
  ["solved_independently", "Solved alone"],
  ["solved_with_help", "With help"],
  ["not_solved", "Not solved"],
];

const HELP: Array<[Exclude<HelpLevel, "none">, string]> = [
  ["hint", "Hint or topic tags"],
  ["approach", "Read the key idea"],
  ["partial_code", "Partial code"],
  ["full_solution", "Full solution"],
];

const OPTIMALITY: Array<[Optimality, string]> = [
  ["optimal", "Optimal"],
  ["suboptimal", "Suboptimal"],
  ["unsure", "Unsure"],
];

const RATINGS: Rating[] = [1, 2, 3, 4];

/** What the user has entered but not saved yet, by attempt (its session's start time). */
interface UnsavedForm {
  draft: AttemptDraft;
  ratingTouched: boolean;
  codeTouched: boolean;
  patternsTouched: boolean;
  detailed: boolean;
  editingCx: number[];
}
const unsavedForms = new Map<string, UnsavedForm>();

interface Props {
  session: AttemptSession;
  problem: ProblemState;
  saving: boolean;
  patternPrefs: PatternPrefs;
  onSave(draft: AttemptDraft): void;
  onTimerRunning(running: boolean): void;
  onRestart(): void;
  onRemoveCheckpoint(index: number): void;
  onCreatePattern(name: string): Promise<string | null>;
  ai: AiStatus;
  /** Checkpoints (by `at`) waiting on a complexity suggestion. */
  analyzing: string[];
  onRetryAnalysis(at: string): void;
  timeboxMinutes: number;
  onTakeHelp(level: Exclude<HelpLevel, "none">): void;
  onDismissNudge(): void;
  onGenerateTwists(): Promise<void>;
  onSetTwists(twists: string[]): Promise<void>;
}

const HELP_ORDER: Array<Exclude<HelpLevel, "none">> = [
  "hint",
  "approach",
  "partial_code",
  "full_solution",
];
const higherHelp = (
  a: Exclude<HelpLevel, "none"> | undefined,
  b: Exclude<HelpLevel, "none"> | undefined,
) => (!a ? b : !b ? a : HELP_ORDER.indexOf(a) >= HELP_ORDER.indexOf(b) ? a : b);

/** The timebox ran out: offer one rung of the hint ladder (spec 5.5). */
function Nudge({
  rung,
  minutes,
  onTake,
  onDismiss,
}: {
  rung: number;
  minutes: number;
  onTake(): void;
  onDismiss(): void;
}) {
  const step = HINT_LADDER[rung]!;
  return (
    <section className="lt-nudge" role="status" aria-label="Timebox">
      <p className="lt-nudge-head">
        {rung === 0 ? `${minutes} minutes in.` : "Still stuck?"} <strong>{step.title}</strong>
      </p>
      <p className="lt-hint">{step.body}</p>
      <div className="lt-nudge-actions">
        <button type="button" className="lt-btn lt-btn-small" onClick={onTake}>
          I used this
        </button>
        <button type="button" className="lt-btn lt-btn-small lt-btn-ghost" onClick={onDismiss}>
          Keep going
        </button>
      </div>
    </section>
  );
}

/** On a review of a problem you know well: a "what if" to answer (spec 5.4). */
function TwistPrompt({
  twists,
  attemptNumber,
  canGenerate,
  answer,
  onAnswer,
  onGenerate,
  onSave,
}: {
  twists: string[];
  attemptNumber: number;
  canGenerate: boolean;
  answer: string;
  onAnswer(text: string): void;
  onGenerate(): Promise<void>;
  onSave(twists: string[]): Promise<void>;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState("");
  const [drafting, setDrafting] = useState(false);
  const asked = useRef(false);
  useEffect(() => {
    // Draft some the first time they're needed, if a model is set up.
    if (twists.length === 0 && canGenerate && !asked.current) {
      asked.current = true;
      setDrafting(true);
      void onGenerate().finally(() => setDrafting(false));
    }
  }, [twists.length, canGenerate, onGenerate]);
  const twist = twists.length ? twists[attemptNumber % twists.length] : undefined;

  return (
    <section className="lt-twist" aria-label="Twist">
      <p className="lt-label">Twist: how would your solution change?</p>
      {twist ? (
        <>
          <p className="lt-twist-q">{twist}</p>
          <textarea
            className="lt-textarea"
            rows={2}
            placeholder="Your answer, in a sentence or two (optional)"
            aria-label="Twist answer"
            value={answer}
            onChange={(e) => onAnswer(e.target.value)}
          />
        </>
      ) : drafting ? (
        <p className="lt-hint">Drafting twists…</p>
      ) : (
        <p className="lt-hint">
          No twists for this problem yet.{canGenerate ? "" : " Add your own below."}
        </p>
      )}
      {editing ? (
        <div className="lt-twist-edit">
          <textarea
            className="lt-textarea"
            rows={4}
            aria-label="Twists, one per line"
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <div className="lt-nudge-actions">
            <button
              type="button"
              className="lt-btn lt-btn-small"
              onClick={() => void onSave(text.split("\n")).then(() => setEditing(false))}
            >
              Save twists
            </button>
            <button
              type="button"
              className="lt-btn lt-btn-small lt-btn-ghost"
              onClick={() => setEditing(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          className="lt-link"
          onClick={() => {
            setText(twists.join("\n"));
            setEditing(true);
          }}
        >
          {twists.length ? "Edit twists" : "Write twists"}
        </button>
      )}
    </section>
  );
}

/** Only the parts of a pair that are set, so it can be spread under exactOptionalPropertyTypes. */
function pair(time: string | undefined, space: string | undefined): Complexity | undefined {
  if (!time && !space) return undefined;
  return { ...(time ? { time } : {}), ...(space ? { space } : {}) };
}
const suggestedPair = (c: SessionCheckpoint | undefined) =>
  pair(c?.suggestion?.time, c?.suggestion?.space);

function Segmented<T extends string | number>({
  label,
  options,
  value,
  onChange,
  error,
  suggested,
}: {
  label: string;
  options: Array<[T, string]>;
  value: T | undefined;
  onChange(v: T): void;
  error?: string | undefined;
  suggested?: T | undefined;
}) {
  return (
    <fieldset className="lt-field">
      <legend className="lt-label">{label}</legend>
      <div className="lt-seg" role="radiogroup" aria-label={label}>
        {options.map(([v, text]) => (
          <button
            key={String(v)}
            type="button"
            role="radio"
            aria-checked={value === v}
            className="lt-seg-btn"
            onClick={() => onChange(v)}
          >
            {text}
            {suggested === v && <span className="lt-suggested">suggested</span>}
          </button>
        ))}
      </div>
      {error && <p className="lt-error">{error}</p>}
    </fieldset>
  );
}

function ComplexitySummary({
  value,
  source,
  name,
  onChange,
}: {
  value: Complexity | undefined;
  source: string;
  name: string;
  onChange(): void;
}) {
  return (
    <p className="lt-cx-summary" aria-label={`${name} complexity`}>
      <span>
        <strong>{value?.time ?? "?"}</strong> time · <strong>{value?.space ?? "?"}</strong> space
      </span>
      <span className="lt-hint">{source}</span>
      <button type="button" className="lt-link" onClick={onChange}>
        Change
      </button>
    </p>
  );
}

function SuggestionStatus({
  checkpoint,
  analyzing,
  edited,
  enabled,
  onRetry,
}: {
  checkpoint: SessionCheckpoint;
  analyzing: boolean;
  edited: boolean;
  enabled: boolean;
  onRetry(): void;
}) {
  if (analyzing) return <p className="lt-cx-status">Estimating complexity…</p>;
  if (checkpoint.suggestion) {
    return (
      <p className="lt-cx-status">
        {edited ? "Edited by you" : `Suggested by ${checkpoint.suggestion.model}. Tap to change.`}
      </p>
    );
  }
  if (checkpoint.suggestionError && enabled) {
    return (
      <p className="lt-cx-status lt-cx-status-bad">
        Couldn't estimate: {checkpoint.suggestionError}{" "}
        <button type="button" className="lt-link" onClick={onRetry}>
          Retry
        </button>
      </p>
    );
  }
  return null;
}

export function LogForm({
  session,
  problem,
  saving,
  patternPrefs,
  onSave,
  onTimerRunning,
  onRestart,
  onRemoveCheckpoint,
  onCreatePattern,
  ai,
  analyzing,
  onRetryAnalysis,
  timeboxMinutes,
  onTakeHelp,
  onDismissNudge,
  onGenerateTwists,
  onSetTwists,
}: Props) {
  const isFirst = problem.attempts.length === 0;
  const kept = unsavedForms.get(session.startedAt);
  const [draft, setDraft] = useState<AttemptDraft>(
    () => kept?.draft ?? { patterns: problem.problem?.patterns ?? [] },
  );
  const [ratingTouched, setRatingTouched] = useState(kept?.ratingTouched ?? false);
  const [codeTouched, setCodeTouched] = useState(kept?.codeTouched ?? false);
  const [showErrors, setShowErrors] = useState(false);
  const [showCode, setShowCode] = useState(false);
  const [showSuggested, setShowSuggested] = useState(false);
  const [patternsTouched, setPatternsTouched] = useState(kept?.patternsTouched ?? false);
  /** After Accepted the form starts as a one-tap summary; this opens the full form. */
  const [detailed, setDetailed] = useState(kept?.detailed ?? false);
  /** Solutions whose suggested complexity the user opened up to change. */
  const [editingCx, setEditingCx] = useState<number[]>(kept?.editingCx ?? []);
  // Keep what's been entered if the form unmounts before saving (panel collapsed or closed,
  // History opened), so it comes back as it was.
  useEffect(() => {
    unsavedForms.set(session.startedAt, {
      draft,
      ratingTouched,
      codeTouched,
      patternsTouched,
      detailed,
      editingCx,
    });
  }, [session.startedAt, draft, ratingTouched, codeTouched, patternsTouched, detailed, editingCx]);

  const update = (patch: Partial<AttemptDraft>) => setDraft((d) => ({ ...d, ...patch }));
  // After an Accepted the likely answers are filled in; anything the user picks wins.
  const hasAccepted = session.submissions.some((s) => s.status === "Accepted");
  // Help taken from the timebox nudges counts as help, like opening the Editorial does.
  const helpSeen = higherHelp(session.helpTaken, suggestHelpLevel(session.viewedSolutionDetected));
  const defaultOutcome: Outcome | undefined = hasAccepted
    ? helpSeen
      ? "solved_with_help"
      : "solved_independently"
    : undefined;
  const outcome = draft.outcome ?? defaultOutcome;
  const helpLevel = draft.helpLevel ?? (outcome === "solved_with_help" ? helpSeen : undefined);
  const solved = outcome && outcome !== "not_solved";
  // Once solved, suggested patterns are no longer spoilers (spec 4.4): start from them.
  const autoPatterns = hasAccepted
    ? resolvedSuggestions(problem.suggestedPatterns, patternPrefs)
    : [];
  const patterns = patternsTouched || draft.patterns.length > 0 ? draft.patterns : autoPatterns;
  const setPatterns = (next: string[]) => {
    setPatternsTouched(true);
    update({ patterns: next });
  };
  const checkpoints = session.checkpoints ?? [];

  // A model's suggestion fills in anything the user hasn't set; their own choice always wins.
  const complexityAt = (i: number) => draft.complexities?.[i] ?? suggestedPair(checkpoints[i]);
  const lastSuggestion = checkpoints.at(-1)?.suggestion;
  const suggestedOptimal = pair(lastSuggestion?.optimalTime, lastSuggestion?.optimalSpace);
  const optimalComplexity = draft.optimalComplexity ?? suggestedOptimal;
  const finalPair = checkpoints.length > 0 ? complexityAt(checkpoints.length - 1) : undefined;
  // Optimal means matching the best known time; space doesn't flip it, so editing space
  // never takes away a pre-selection.
  const suggestedOptimality: Optimality | undefined =
    finalPair?.time && suggestedOptimal?.time
      ? finalPair.time === suggestedOptimal.time
        ? "optimal"
        : "suboptimal"
      : undefined;
  const optimality =
    draft.optimality ??
    (solved ? (suggestedOptimality ?? (hasAccepted ? "unsure" : undefined)) : undefined);
  const complexities =
    checkpoints.length > 0 ? checkpoints.map((_, i) => complexityAt(i) ?? {}) : draft.complexities;

  const effective: AttemptDraft = {
    ...draft,
    patterns,
    ...(outcome ? { outcome } : {}),
    ...(helpLevel ? { helpLevel } : {}),
    ...(optimality ? { optimality } : {}),
    ...(complexities ? { complexities } : {}),
    ...(optimalComplexity ? { optimalComplexity } : {}),
  };
  const suggested = suggestRating(effective, {
    solveSeconds: solveSeconds(session),
    medianSeconds: problem.medianSolveSeconds,
  });
  const rating = ratingTouched ? draft.rating : suggested;
  const finalDraft: AttemptDraft = {
    ...effective,
    ...(rating ? { rating } : {}),
    ...(codeTouched ? {} : { code: undefined }),
  };
  const errors = validateDraft(finalDraft);

  const chooseOutcome = (outcome: Outcome) => {
    const patch: Partial<AttemptDraft> = { outcome };
    if (outcome === "solved_with_help" && !draft.helpLevel && helpSeen) {
      patch.helpLevel = helpSeen;
    }
    update(patch);
  };

  const submit = () => {
    if (Object.keys(errors).length > 0) {
      setShowErrors(true);
      setDetailed(true);
      return;
    }
    unsavedForms.delete(session.startedAt);
    onSave(finalDraft);
  };
  const err = (k: keyof AttemptDraft) => (showErrors ? errors[k] : undefined);
  const stopped = Boolean(session.stoppedAt);
  const totalSeconds =
    (Date.parse(session.stoppedAt ?? new Date().toISOString()) - Date.parse(session.startedAt)) /
    1000;
  const lastCheckpoint = checkpoints.at(-1);
  const suggestions = resolvedSuggestions(problem.suggestedPatterns, patternPrefs).filter(
    (id) => !patterns.includes(id),
  );
  const quick = hasAccepted && !detailed;
  const rung = hasAccepted ? -1 : timeboxRung(session.activeSeconds, timeboxMinutes);
  const nudgeRung = rung > (session.nudgeDismissed ?? -1) ? rung : -1;
  // Twists are for problems you know well: a full review of a mature card that ends Accepted.
  const showTwist = hasAccepted && !isFirst && Boolean(problem.card?.quickEligible);
  const leetcodeTags = problem.problem?.leetcodeTopics ?? [];
  const atCheckpoint = stopped && lastCheckpoint?.activeSeconds === session.activeSeconds;
  const accepted = session.submissions.filter((s) => s.status === "Accepted").length;
  const showComplexity = outcome !== "not_solved" && (solved || checkpoints.length > 0);

  const setComplexity = (i: number, c: Complexity) => {
    const complexities = [...(draft.complexities ?? [])];
    complexities[i] = c;
    update({ complexities });
  };
  const removeCheckpoint = (i: number) => {
    // Array.from fills holes, so later entries shift down with their checkpoints.
    const all = Array.from(
      { length: draft.complexities?.length ?? 0 },
      (_, j) => draft.complexities?.[j],
    );
    update({ complexities: all.filter((_, j) => j !== i) as Complexity[] });
    onRemoveCheckpoint(i);
  };

  return (
    <form
      className="lt-form"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className={`lt-timer${stopped ? " lt-timer-stopped" : ""}`}>
        <div className="lt-timer-main">
          <span className="lt-timer-dot" aria-hidden="true" />
          <span className="lt-timer-value" aria-label="Solve time">
            {formatDuration(session.activeSeconds)}
          </span>
          <span className="lt-timer-state">
            {stopped ? (atCheckpoint ? "stopped at Accepted" : "stopped") : "timing"}
          </span>
        </div>
        <div className="lt-timer-actions">
          <button
            type="button"
            className="lt-btn lt-btn-small"
            onClick={() => onTimerRunning(stopped)}
          >
            {atCheckpoint ? "Keep optimizing" : stopped ? "Resume" : "Stop"}
          </button>
          <button
            type="button"
            className="lt-btn lt-btn-small lt-btn-ghost"
            onClick={() => {
              if (window.confirm("Discard this attempt's time and submissions and start over?"))
                onRestart();
            }}
          >
            Restart
          </button>
        </div>
      </div>

      {nudgeRung >= 0 && (
        <Nudge
          rung={nudgeRung}
          minutes={timeboxMinutes}
          onTake={() => onTakeHelp(HINT_LADDER[nudgeRung]!.level)}
          onDismiss={onDismissNudge}
        />
      )}

      {checkpoints.length > 0 && (
        <ol className="lt-solutions" aria-label="Solutions">
          {checkpoints.map((c, i) => (
            <li key={c.at} className="lt-solution">
              <div className="lt-solution-head">
                <span className="lt-solution-n">
                  {checkpoints.length > 1 ? `Solution ${i + 1}` : "Accepted at"}
                </span>
                <span className="lt-solution-time">{formatDuration(c.activeSeconds)}</span>
                {i > 0 && (
                  <span className="lt-solution-delta">
                    +{formatDuration(c.activeSeconds - checkpoints[i - 1]!.activeSeconds)}
                  </span>
                )}
                {checkpoints.length > 1 && (
                  <button
                    type="button"
                    className="lt-chip-x lt-solution-x"
                    aria-label={`Remove solution ${i + 1}`}
                    title="Not a new solution? Remove it."
                    onClick={() => removeCheckpoint(i)}
                  >
                    ×
                  </button>
                )}
              </div>
              {showComplexity && c.suggestion && !editingCx.includes(i) ? (
                <ComplexitySummary
                  value={complexityAt(i)}
                  source={
                    draft.complexities?.[i] !== undefined
                      ? "edited by you"
                      : `suggested by ${c.suggestion.model}`
                  }
                  name={`Solution ${i + 1}`}
                  onChange={() => setEditingCx((e) => [...e, i])}
                />
              ) : showComplexity ? (
                <ComplexityPicker
                  name={`Solution ${i + 1}`}
                  value={complexityAt(i)}
                  onChange={(c) => setComplexity(i, c)}
                />
              ) : null}
              {showComplexity && (!c.suggestion || editingCx.includes(i)) && (
                <SuggestionStatus
                  checkpoint={c}
                  analyzing={analyzing.includes(c.at)}
                  edited={draft.complexities?.[i] !== undefined}
                  enabled={ai.enabled}
                  onRetry={() => onRetryAnalysis(c.at)}
                />
              )}
            </li>
          ))}
        </ol>
      )}
      {atCheckpoint && checkpoints.length === 1 && (
        <p className="lt-hint">
          Going for a better solution? Keep optimizing and the next Accepted is saved as a second
          checkpoint on the same clock.
        </p>
      )}

      {showTwist && (
        <TwistPrompt
          twists={problem.problem?.twists ?? []}
          attemptNumber={problem.attempts.length}
          canGenerate={ai.enabled}
          answer={draft.twistAnswer ?? ""}
          onAnswer={(twistAnswer) => update({ twistAnswer })}
          onGenerate={onGenerateTwists}
          onSave={onSetTwists}
        />
      )}

      {quick && (
        <section className="lt-quick" aria-label="Attempt summary">
          <dl>
            <div>
              <dt>Outcome</dt>
              <dd>
                {OUTCOMES.find(([v]) => v === outcome)?.[1]}
                {outcome === "solved_with_help" && helpLevel
                  ? ` · ${HELP.find(([v]) => v === helpLevel)?.[1]}`
                  : ""}
              </dd>
            </div>
            {solved && (
              <div>
                <dt>Optimality</dt>
                <dd>
                  {OPTIMALITY.find(([v]) => v === optimality)?.[1]}
                  {optimality === suggestedOptimality && suggestedOptimality && (
                    <span className="lt-hint"> · from the suggested complexity</span>
                  )}
                </dd>
              </div>
            )}
            <div>
              <dt>Confidence</dt>
              <dd>{rating ? RATING_LABELS[rating] : "—"}</dd>
            </div>
            <div>
              <dt>Patterns</dt>
              <dd>
                {patterns.length
                  ? patterns.map((id) => patternName(id, patternPrefs)).join(", ")
                  : "none"}
              </dd>
            </div>
            {leetcodeTags.length > 0 && (
              <div>
                <dt>LeetCode tags</dt>
                <dd className="lt-hint">{leetcodeTags.join(", ")}</dd>
              </div>
            )}
          </dl>
          <label className="lt-field">
            <span className="lt-label">
              Notes <span className="lt-hint">optional · Markdown</span>
            </span>
            <textarea
              className="lt-input lt-textarea"
              rows={2}
              placeholder="Anything to remember for next time"
              value={draft.notes ?? ""}
              onChange={(e) => update({ notes: e.target.value })}
            />
          </label>
          {isFirst && (
            <label className="lt-check">
              <input
                type="checkbox"
                checked={draft.seenBefore ?? false}
                onChange={(e) => update({ seenBefore: e.target.checked })}
              />
              I&apos;ve seen this problem before
            </label>
          )}
        </section>
      )}

      {!quick && (
        <>
          <dl className="lt-observed">
            <div>
              <dt>Total time</dt>
              <dd>{formatDuration(totalSeconds)}</dd>
            </div>
            <div>
              <dt>Submissions</dt>
              <dd title={session.submissions.map((s) => s.status).join(", ")}>
                {session.submissions.length}
                {session.submissions.length > 0 && ` (${accepted} AC)`}
              </dd>
            </div>
            <div>
              <dt>Language</dt>
              <dd>{session.language ?? "—"}</dd>
            </div>
            <div>
              <dt>Solution viewed</dt>
              <dd>{session.viewedSolutionDetected ? "Yes" : "No"}</dd>
            </div>
          </dl>

          <Segmented
            label="Outcome"
            options={OUTCOMES}
            value={outcome}
            onChange={chooseOutcome}
            error={err("outcome")}
            suggested={defaultOutcome}
          />

          {outcome === "solved_with_help" && (
            <Segmented
              label="Most help used"
              options={HELP}
              value={helpLevel}
              onChange={(helpLevel) => update({ helpLevel })}
              error={err("helpLevel")}
            />
          )}

          {solved && (
            <Segmented
              label="Optimality"
              options={OPTIMALITY}
              value={optimality}
              onChange={(optimality) => update({ optimality })}
              error={err("optimality")}
              suggested={suggestedOptimality}
            />
          )}

          {solved && checkpoints.length === 0 && (
            <div className="lt-field">
              <span className="lt-label">Complexity</span>
              <ComplexityPicker
                name="Solution"
                value={draft.complexities?.[0]}
                onChange={(c) => setComplexity(0, c)}
              />
            </div>
          )}

          {solved && optimality === "suboptimal" && (
            <div className="lt-field">
              <span className="lt-label">
                Optimal complexity <span className="lt-hint">optional</span>
              </span>
              <ComplexityPicker
                name="Optimal"
                value={optimalComplexity}
                onChange={(optimalComplexity) => update({ optimalComplexity })}
              />
            </div>
          )}

          <fieldset className="lt-field">
            <legend className="lt-label">Confidence</legend>
            <div className="lt-ratings" role="radiogroup" aria-label="Confidence">
              {RATINGS.map((r) => (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={rating === r}
                  className={`lt-rating lt-rating-${r}`}
                  onClick={() => {
                    setRatingTouched(true);
                    update({ rating: r });
                  }}
                >
                  {RATING_LABELS[r]}
                  {suggested === r && <span className="lt-suggested">suggested</span>}
                </button>
              ))}
            </div>
            {err("rating") && <p className="lt-error">{err("rating")}</p>}
          </fieldset>

          <fieldset className="lt-field">
            <legend className="lt-label">Patterns</legend>
            <TagInput
              value={patterns}
              patternPrefs={patternPrefs}
              onChange={setPatterns}
              onCreate={onCreatePattern}
            />
            {leetcodeTags.length > 0 && outcome && (
              <span className="lt-hint">LeetCode tags: {leetcodeTags.join(", ")}</span>
            )}
            {/* Spec 4.4: suggestions would give the approach away, so only after an outcome. */}
            {outcome && suggestions.length > 0 && !showSuggested && (
              <button type="button" className="lt-link" onClick={() => setShowSuggested(true)}>
                Show suggested patterns
              </button>
            )}
            {outcome && showSuggested && (
              <div className="lt-suggest-row" aria-label="Suggested patterns">
                {suggestions.length === 0 && (
                  <span className="lt-hint">All suggestions added.</span>
                )}
                {suggestions.map((id) => (
                  <button
                    key={id}
                    type="button"
                    className="lt-chip lt-chip-create"
                    onClick={() => setPatterns([...patterns, id])}
                  >
                    + {patternName(id, patternPrefs)}
                  </button>
                ))}
              </div>
            )}
          </fieldset>

          <label className="lt-field">
            <span className="lt-label">Pattern clue: what told you which pattern to use?</span>
            <input
              className="lt-input"
              value={draft.patternClue ?? ""}
              onChange={(e) => update({ patternClue: e.target.value })}
            />
          </label>

          <label className="lt-field">
            <span className="lt-label">Where I got stuck</span>
            <input
              className="lt-input"
              value={draft.stuckNote ?? ""}
              onChange={(e) => update({ stuckNote: e.target.value })}
            />
          </label>

          <label className="lt-field">
            <span className="lt-label">
              Notes <span className="lt-hint">Markdown</span>
            </span>
            <textarea
              className="lt-input lt-textarea"
              rows={4}
              value={draft.notes ?? ""}
              onChange={(e) => update({ notes: e.target.value })}
            />
          </label>

          <div className="lt-field">
            <button
              type="button"
              className="lt-link"
              onClick={() => setShowCode((s) => !s)}
              aria-expanded={showCode}
            >
              {showCode ? "Hide code" : session.code ? "Show captured code" : "Add code"}
            </button>
            {showCode && (
              <textarea
                className="lt-input lt-textarea lt-code"
                rows={8}
                spellCheck={false}
                value={codeTouched ? (draft.code ?? "") : (session.code ?? "")}
                onChange={(e) => {
                  setCodeTouched(true);
                  update({ code: e.target.value });
                }}
              />
            )}
          </div>

          {isFirst && (
            <label className="lt-check">
              <input
                type="checkbox"
                checked={draft.seenBefore ?? false}
                onChange={(e) => update({ seenBefore: e.target.checked })}
              />
              I've seen this problem before (not a cold attempt)
            </label>
          )}
        </>
      )}

      <div className="lt-actions">
        {showErrors && Object.keys(errors).length > 0 && (
          <span className="lt-error">Fill in the highlighted fields.</span>
        )}
        {quick && (
          <button
            type="button"
            className="lt-btn lt-btn-ghost"
            title="Outcome, optimality, confidence, patterns, pattern clue, where you got stuck, code"
            onClick={() => setDetailed(true)}
          >
            Edit details
          </button>
        )}
        <button type="submit" className="lt-btn lt-btn-primary" disabled={saving}>
          {saving ? "Saving…" : "Save attempt"}
        </button>
      </div>
    </form>
  );
}
