import type {
  Attempt,
  CardState,
  CustomList,
  DerivedStatus,
  Difficulty,
  MasteryInsights,
  PatternMastery,
  Problem,
  ProblemStatus,
  Settings,
  MockInterview,
} from "@leettrack/core";

/** Everything a user has, wherever it's stored (IndexedDB in the extension, Postgres online). */
export interface DataSet {
  problems: readonly Problem[];
  attempts: readonly Attempt[];
  settings: Settings;
  customLists?: readonly CustomList[];
  mocks?: readonly MockInterview[];
}

/** A problem's FSRS card, as the UI needs it. Recomputed from attempts on every read. */
export interface CardSummary {
  due: string;
  state: CardState["state"];
  stabilityDays: number;
  /** Estimated chance of recalling it right now, 0 to 1. */
  retrievability: number;
  reps: number;
  lapses: number;
  /** Due today or overdue. */
  isDue: boolean;
  isLeech: boolean;
  quickEligible: boolean;
  /** Brought forward for an extra review before this interview. */
  forTarget?: string;
}

export interface ProblemState {
  slug: string;
  problem?: Problem;
  attempts: Attempt[];
  status: DerivedStatus;
  /** Median active time of past independent solves at this difficulty. */
  medianSolveSeconds?: number;
  card?: CardSummary;
  /** Pattern ids suggested by seed data and LeetCode topics. Spoilers: show only after logging. */
  suggestedPatterns: string[];
}

export interface Stats {
  problemsAttempted: number;
  attempts: number;
  fullySolved: number;
  /** Reviews in today's queue. */
  dueToday: number;
  leeches: number;
}

export interface ListProgress {
  id: string;
  name: string;
  /** "seed" lists ship with LeetTrack; "custom" ones are the user's. */
  kind: "seed" | "custom";
  active: boolean;
  total: number;
  byStatus: Record<ProblemStatus, number>;
}

export interface LeechInfo {
  slug: string;
  title: string;
  againCount: number;
  stuckNotes: Array<{ at: string; note: string }>;
}

export interface Dashboard {
  patterns: PatternMastery[];
  insights: MasteryInsights;
  lists: ListProgress[];
  leeches: LeechInfo[];
}

/** Display facts for a problem, from its record or the seed data. */
export interface ProblemInfo {
  title?: string;
  frontendId?: string;
  difficulty?: Difficulty;
}
