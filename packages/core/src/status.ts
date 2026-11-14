import { CONFIG } from "./config";
import type { Attempt, Optimality, Problem, ProblemStatus } from "./types";

export interface DerivedStatus {
  status: ProblemStatus;
  /** Present for fully_solved / mastered: taken from the most recent independent solve. */
  optimality?: Optimality;
  /** True when the status comes from a manual override rather than attempt history. */
  overridden: boolean;
}

const byEndedAt = (a: Attempt, b: Attempt) => a.endedAt.localeCompare(b.endedAt);

/**
 * Derive a problem's status from its attempts (spec 4.5).
 * `stabilityDays` comes from the FSRS card (M2); without it a problem can't be "mastered".
 */
export function deriveStatus(
  problem: Pick<Problem, "statusOverride"> | undefined,
  attempts: readonly Attempt[],
  stabilityDays?: number,
): DerivedStatus {
  const override = problem?.statusOverride;
  if (override) {
    return {
      status: override.status,
      ...(override.optimality ? { optimality: override.optimality } : {}),
      overridden: true,
    };
  }
  if (attempts.length === 0) return { status: "unseen", overridden: false };

  // A quick review (spec 5.4) says nothing about optimality: take it from full solves.
  const fullSolves = attempts.filter((a) => a.outcome === "solved_independently");
  const independent = (
    fullSolves.some((a) => a.kind !== "quick")
      ? fullSolves.filter((a) => a.kind !== "quick")
      : fullSolves
  ).sort(byEndedAt);
  const latestIndependent = independent.at(-1);
  if (latestIndependent) {
    const optimality = latestIndependent.optimality ?? "unsure";
    const mastered =
      optimality === "optimal" &&
      stabilityDays !== undefined &&
      stabilityDays > CONFIG.masteredStabilityDays;
    return { status: mastered ? "mastered" : "fully_solved", optimality, overridden: false };
  }
  if (attempts.some((a) => a.outcome === "solved_with_help")) {
    return { status: "solved_with_help", overridden: false };
  }
  return { status: "in_progress", overridden: false };
}

export const STATUS_LABELS: Record<ProblemStatus, string> = {
  unseen: "Unseen",
  in_progress: "In progress",
  solved_with_help: "Solved with help",
  fully_solved: "Fully solved",
  mastered: "Mastered",
};
