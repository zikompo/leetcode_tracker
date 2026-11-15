import type {
  Attempt,
  AttemptDraft,
  Checkpoint,
  Complexity,
  HelpLevel,
  Rating,
  SessionObservation,
} from "./types";

export type DraftErrors = Partial<Record<keyof AttemptDraft, string>>;

export function validateDraft(draft: AttemptDraft): DraftErrors {
  const errors: DraftErrors = {};
  if (!draft.outcome) errors.outcome = "Choose an outcome.";
  if (draft.outcome === "solved_with_help" && !draft.helpLevel) {
    errors.helpLevel = "Choose how much help you used.";
  }
  if (draft.outcome && draft.outcome !== "not_solved" && !draft.optimality) {
    errors.optimality = "Choose whether the solution is optimal.";
  }
  if (!draft.rating) errors.rating = "Choose a confidence rating.";
  return errors;
}

export const isDraftValid = (draft: AttemptDraft) => Object.keys(validateDraft(draft)).length === 0;

/** Pre-selected help level when the extension saw the Editorial or Solutions tab opened. */
export function suggestHelpLevel(viewedSolution: boolean): Exclude<HelpLevel, "none"> | undefined {
  return viewedSolution ? "approach" : undefined;
}

const trimOrUndefined = (s: string | undefined) => {
  const t = s?.trim();
  return t ? t : undefined;
};

/** "O(n) time, O(1) space"; undefined when neither is set. */
export function formatComplexity(c: Complexity | undefined): string | undefined {
  const time = trimOrUndefined(c?.time);
  const space = trimOrUndefined(c?.space);
  const parts = [time && `${time} time`, space && `${space} space`].filter(Boolean);
  return parts.length ? parts.join(", ") : undefined;
}

function withComplexity(c: Checkpoint, x: Complexity | undefined): Checkpoint {
  const out: Checkpoint = { at: c.at, activeSeconds: c.activeSeconds };
  const time = trimOrUndefined(x?.time);
  const space = trimOrUndefined(x?.space);
  if (time) out.time = time;
  if (space) out.space = space;
  return out;
}

export interface BuildAttemptInput {
  slug: string;
  draft: AttemptDraft;
  session: SessionObservation;
  suggestedRating: Rating;
  priorAttemptCount: number;
  now?: Date;
  id?: string;
}

/** Turn a validated draft plus session observations into an immutable Attempt record. */
export function buildAttempt(input: BuildAttemptInput): Attempt {
  const { draft, session } = input;
  const errors = validateDraft(draft);
  if (Object.keys(errors).length > 0) {
    throw new Error(`Invalid attempt draft: ${Object.values(errors).join(" ")}`);
  }
  const now = (input.now ?? new Date()).toISOString();
  const outcome = draft.outcome!;
  const attempt: Attempt = {
    id: input.id ?? crypto.randomUUID(),
    problemSlug: input.slug,
    startedAt: session.startedAt,
    endedAt: session.stoppedAt ?? now,
    activeSeconds: Math.round(session.activeSeconds),
    isCold: input.priorAttemptCount === 0 && !draft.seenBefore,
    kind: "full",
    outcome,
    helpLevel: outcome === "solved_with_help" ? draft.helpLevel! : "none",
    viewedSolutionDetected: session.viewedSolutionDetected,
    suggestedRating: input.suggestedRating,
    rating: draft.rating!,
    submissions: session.submissions,
    createdAt: now,
    updatedAt: now,
  };
  if (outcome !== "not_solved" && draft.optimality) attempt.optimality = draft.optimality;
  const checkpoints = session.checkpoints ?? [];
  const complexities = draft.complexities ?? [];
  if (checkpoints.length > 0) {
    attempt.checkpoints = checkpoints.map((c, i) => withComplexity(c, complexities[i]));
  }
  const solved = outcome !== "not_solved";
  const achieved = solved
    ? formatComplexity(complexities[Math.max(checkpoints.length, 1) - 1])
    : undefined;
  const optional = {
    complexityAchieved: achieved,
    complexityOptimal: !solved
      ? undefined
      : draft.optimality === "optimal"
        ? achieved
        : draft.optimality === "suboptimal"
          ? formatComplexity(draft.optimalComplexity)
          : undefined,
    patternClue: trimOrUndefined(draft.patternClue),
    stuckNote: trimOrUndefined(draft.stuckNote),
    notes: trimOrUndefined(draft.notes),
    twistAnswer: trimOrUndefined(draft.twistAnswer),
    code: draft.code ?? session.code,
    language: session.language,
  };
  for (const [k, v] of Object.entries(optional)) {
    if (v !== undefined && v !== "") (attempt as unknown as Record<string, unknown>)[k] = v;
  }
  return attempt;
}

export interface QuickReviewInput {
  slug: string;
  session: SessionObservation;
  /** The approach in the user's words, written before revealing their notes. */
  approach?: string;
  complexity?: Complexity;
  rating: Rating;
  now?: Date;
  id?: string;
}

/**
 * A quick review (spec 5.4): approach and expected complexity from memory, then a self-rating.
 * Counts for scheduling like any attempt; Again counts as not recalled.
 */
export function buildQuickAttempt(input: QuickReviewInput): Attempt {
  const now = (input.now ?? new Date()).toISOString();
  const attempt: Attempt = {
    id: input.id ?? crypto.randomUUID(),
    problemSlug: input.slug,
    startedAt: input.session.startedAt,
    endedAt: now,
    activeSeconds: Math.round(input.session.activeSeconds),
    isCold: false,
    kind: "quick",
    outcome: input.rating === 1 ? "not_solved" : "solved_independently",
    helpLevel: "none",
    viewedSolutionDetected: input.session.viewedSolutionDetected,
    suggestedRating: input.rating,
    rating: input.rating,
    submissions: input.session.submissions,
    createdAt: now,
    updatedAt: now,
  };
  const approach = trimOrUndefined(input.approach);
  if (approach) attempt.notes = approach;
  const complexity = formatComplexity(input.complexity);
  if (complexity) attempt.complexityAchieved = complexity;
  return attempt;
}

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${sec.toString().padStart(2, "0")}s`;
  return `${sec}s`;
}
