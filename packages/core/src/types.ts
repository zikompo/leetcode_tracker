// Shared domain types (spec Section 9.1). Pure data, no runtime dependencies.

export type Difficulty = "Easy" | "Medium" | "Hard";
export type Outcome = "solved_independently" | "solved_with_help" | "not_solved";
export type HelpLevel = "none" | "hint" | "approach" | "partial_code" | "full_solution";
export type Optimality = "optimal" | "suboptimal" | "unsure";
export type Rating = 1 | 2 | 3 | 4; // Again, Hard, Good, Easy

export type ProblemStatus =
  "unseen" | "in_progress" | "solved_with_help" | "fully_solved" | "mastered";

export interface StatusOverride {
  status: ProblemStatus;
  optimality?: Optimality;
  at: string;
}

export interface Problem {
  slug: string; // primary key
  frontendId: string; // "1"
  title: string;
  difficulty: Difficulty;
  url: string;
  leetcodeTopics: string[];
  patterns: string[]; // user-confirmed pattern ids
  suggestedPatterns: string[]; // from seed data, hidden until attempt logged
  lists: string[];
  twists?: string[];
  statusOverride?: StatusOverride;
  updatedAt: string;
}

export interface Submission {
  at: string;
  status: string; // "Accepted", "Wrong Answer", ...
  runtimeMs?: number;
  memoryMb?: number;
  runtimePercentile?: number;
  memoryPercentile?: number;
}

/** Big-O for one solution, picked from chips (free text allowed), e.g. { time: "O(n)", space: "O(1)" }. */
export interface Complexity {
  time?: string;
  space?: string;
}

/**
 * A working solution reached during an attempt: each Accepted marks one. The clock keeps
 * running across checkpoints, so later ones show how long it took to go from one solution
 * to the next (e.g. brute force, then optimal).
 */
export interface Checkpoint extends Complexity {
  at: string;
  /** Active seconds on the attempt clock when this solution was accepted. */
  activeSeconds: number;
}

export interface Attempt {
  id: string; // uuid, immutable
  problemSlug: string;
  startedAt: string;
  endedAt: string;
  activeSeconds: number;
  secondsToApproach?: number;
  isCold: boolean;
  kind: "full" | "quick";
  outcome: Outcome;
  helpLevel: HelpLevel;
  viewedSolutionDetected: boolean;
  optimality?: Optimality;
  /** Final solution's complexity, formatted ("O(n) time, O(1) space"). */
  complexityAchieved?: string;
  complexityOptimal?: string;
  /** Each working solution reached, in order. Absent when nothing was accepted. */
  checkpoints?: Checkpoint[];
  suggestedRating: Rating;
  rating: Rating;
  patternClue?: string;
  stuckNote?: string;
  notes?: string; // markdown
  code?: string;
  language?: string;
  submissions: Submission[];
  twistAnswer?: string;
  createdAt: string;
  updatedAt: string;
}

/** FSRS state, one per problem. Recomputed from attempts (see fsrs.ts), never stored. */
export interface CardState {
  problemSlug: string;
  /** Next review, as a whole number of days after the last one. */
  due: string;
  stability: number;
  /** FSRS-7 short-term stability; needed to compute retrievability. */
  stabilityFast: number;
  difficulty: number;
  reps: number;
  lapses: number;
  state: "new" | "learning" | "review" | "relearning";
  lastReview?: string;
}

export interface TargetDate {
  id: string;
  label: string;
  date: string;
  listIds: string[];
}

/** What the extension observed during an attempt session (auto-filled, read-only in the panel). */
export interface SessionObservation {
  startedAt: string;
  activeSeconds: number;
  submissions: Submission[];
  viewedSolutionDetected: boolean;
  language?: string;
  code?: string;
  /** Set when the timer stopped (automatically on Accepted, or by the user). Ends the attempt's clock. */
  stoppedAt?: string;
  /** One per Accepted, recorded automatically. Complexity is filled in from the draft on save. */
  checkpoints?: Checkpoint[];
}

/** What the user enters in the log panel (spec 4.3). */
export interface AttemptDraft {
  outcome?: Outcome;
  helpLevel?: Exclude<HelpLevel, "none">;
  optimality?: Optimality;
  /**
   * Complexity per solution, index-aligned with the session's checkpoints. With no
   * checkpoints, entry 0 is the single solution.
   */
  complexities?: Complexity[];
  /** Only asked for when the solution is suboptimal; equals the achieved one when optimal. */
  optimalComplexity?: Complexity;
  rating?: Rating;
  patterns: string[];
  patternClue?: string;
  stuckNote?: string;
  notes?: string;
  code?: string;
  /** Only meaningful on a first attempt: user has seen this problem before (not cold). */
  seenBefore?: boolean;
}

export type PanelAutoOpen = "accepted" | "every_submission" | "manual";

/** A user-created pattern tag, alongside the built-in taxonomy. */
export interface CustomPattern {
  id: string;
  name: string;
}

export interface Settings {
  panelAutoOpen: PanelAutoOpen;
  customPatterns?: CustomPattern[];
  /** Display names for renamed built-in patterns, by id. */
  patternRenames?: Record<string, string>;
  /** Merged patterns: source id → the id it was merged into. */
  patternMerges?: Record<string, string>;
  /** Max new problems started per day (spec 4.7). */
  dailyNewLimit: number;
  /** Max reviews per day. */
  dailyReviewLimit: number;
  /** Scheduler target recall probability, 0.7 to 0.97. */
  desiredRetention: number;
  /** Seed list ids new problems come from, in priority order. */
  activeLists: string[];
  /** Hide LeetCode's topic tags while the attempt timer runs (spec 4.4). */
  hideTopicsWhileSolving: boolean;
  updatedAt: string;
}

export const DEFAULT_SETTINGS: Settings = {
  panelAutoOpen: "accepted",
  dailyNewLimit: 3,
  dailyReviewLimit: 20,
  desiredRetention: 0.9,
  activeLists: ["neetcode150"],
  hideTopicsWhileSolving: false,
  updatedAt: new Date(0).toISOString(),
};
