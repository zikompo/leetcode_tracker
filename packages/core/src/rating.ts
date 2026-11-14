import { CONFIG } from "./config";
import type { Attempt, AttemptDraft, Difficulty, Rating } from "./types";

export const RATING_LABELS: Record<Rating, string> = {
  1: "Again",
  2: "Hard",
  3: "Good",
  4: "Easy",
};

export function median(values: readonly number[]): number | undefined {
  if (values.length === 0) return undefined;
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1]! + s[mid]!) / 2;
}

/**
 * Time to the final working solution: the last checkpoint if there is one (time spent
 * after it, e.g. a failed optimisation, doesn't count), else the whole active time.
 */
export function solveSeconds(a: Pick<Attempt, "activeSeconds" | "checkpoints">): number {
  return a.checkpoints?.at(-1)?.activeSeconds ?? a.activeSeconds;
}

/** A past attempt and its problem's difficulty, used to judge solve speed. */
export interface TimedHistoryItem {
  difficulty: Difficulty;
  attempt: Pick<Attempt, "outcome" | "activeSeconds" | "checkpoints"> &
    Partial<Pick<Attempt, "kind">>;
}

/**
 * Median time-to-final-solution of past independent solves at one difficulty.
 * Undefined until there are enough samples.
 */
export function medianSolveSeconds(
  history: readonly TimedHistoryItem[],
  difficulty: Difficulty,
): number | undefined {
  const samples = history
    .filter(
      (h) =>
        h.difficulty === difficulty &&
        h.attempt.kind !== "quick" && // a quick review isn't a timed solve
        h.attempt.outcome === "solved_independently" &&
        solveSeconds(h.attempt) > 0,
    )
    .map((h) => solveSeconds(h.attempt));
  return samples.length >= CONFIG.minSamplesForSpeed ? median(samples) : undefined;
}

export interface SolveTiming {
  /** Active seconds this attempt took. */
  solveSeconds?: number;
  /** Median for this difficulty, from {@link medianSolveSeconds}. */
  medianSeconds?: number;
}

/**
 * Suggest an FSRS rating from the attempt fields (spec 5.2). The user can override it.
 * Returns undefined until an outcome is chosen.
 */
export function suggestRating(
  draft: Pick<AttemptDraft, "outcome" | "helpLevel" | "optimality">,
  timing: SolveTiming = {},
): Rating | undefined {
  switch (draft.outcome) {
    case undefined:
      return undefined;
    case "not_solved":
      return 1;
    case "solved_with_help":
      return draft.helpLevel === "partial_code" || draft.helpLevel === "full_solution" ? 1 : 2;
    case "solved_independently": {
      const { solveSeconds: seconds, medianSeconds } = timing;
      const slow = seconds !== undefined && medianSeconds !== undefined && seconds > medianSeconds;
      const fast =
        seconds !== undefined &&
        medianSeconds !== undefined &&
        seconds <= medianSeconds * CONFIG.fastRatio;
      if (draft.optimality === "suboptimal" || slow) return 2;
      if (draft.optimality === "optimal" && fast) return 4;
      return 3;
    }
  }
}
