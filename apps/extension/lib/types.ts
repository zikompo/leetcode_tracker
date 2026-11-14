import type {
  Attempt,
  CardState,
  Checkpoint,
  DerivedStatus,
  MasteryInsights,
  PatternMastery,
  Problem,
  ProblemStatus,
  Queue,
  SessionObservation,
  Settings,
  StatusOverride,
} from "@leettrack/core";
import type { ProblemMetadata } from "../adapters/leetcode";
import type { AiStatus, AnalysisInput, ComplexitySuggestion } from "./ai";

/** A checkpoint while the attempt is open: also keeps the code and any model suggestion. */
export interface SessionCheckpoint extends Checkpoint {
  /** The code that was accepted; sent for a complexity suggestion, never saved with the attempt. */
  code?: string;
  language?: string;
  suggestion?: ComplexitySuggestion;
  suggestionError?: string;
}

/** In-progress attempt for one problem, persisted in chrome.storage.session. */
export interface AttemptSession extends SessionObservation {
  slug: string;
  lastActiveAt: string;
  /** Submission ids already recorded, to dedupe repeated events. */
  submissionIds: string[];
  checkpoints?: SessionCheckpoint[];
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

export interface ImportSummary {
  attemptsAdded: number;
  attemptsUpdated: number;
  problemsMerged: number;
}

/** Every request the background service worker answers. */
export interface Api {
  getProblemState(slug: string): ProblemState;
  upsertProblemMeta(meta: ProblemMetadata): ProblemState;
  saveAttempt(input: { attempt: Attempt; patterns: string[] }): ProblemState;
  setStatusOverride(input: { slug: string; override: StatusOverride | null }): ProblemState;
  getSession(slug: string): AttemptSession | null;
  putSession(session: AttemptSession): void;
  clearSession(slug: string): void;
  getSettings(): Settings;
  setSettings(patch: Partial<Omit<Settings, "updatedAt">>): Settings;
  /** Create (or reuse) a custom pattern tag by name; returns its id and the updated settings. */
  addCustomPattern(name: string): { id: string; settings: Settings };
  getStats(): Stats;
  /** Today's queue (spec 5.3); the badge shows its review count. */
  getQueue(): Queue;
  /** Pattern mastery, list progress and leeches for the dashboard. */
  getDashboard(): Dashboard;
  renamePattern(input: { id: string; name: string }): Settings;
  /** Fold one pattern into another everywhere; the source disappears from the taxonomy. */
  mergePattern(input: { from: string; into: string }): Settings;
  exportData(): string;
  importData(json: string): ImportSummary;
  /** Whether complexity suggestions are set up, and with what. */
  getAiStatus(): AiStatus;
  /** Ask the configured model for a complexity estimate. Sends the code to that provider. */
  analyzeComplexity(input: AnalysisInput): ComplexitySuggestion;
}

export type ApiMethod = keyof Api;
export type ApiArgs<K extends ApiMethod> = Parameters<Api[K]>;
export type ApiResult<K extends ApiMethod> = ReturnType<Api[K]>;

export interface ApiRequest<K extends ApiMethod = ApiMethod> {
  kind: "leettrack-api";
  method: K;
  args: ApiArgs<K>;
}

export type ApiResponse<T = unknown> = { ok: true; value: T } | { ok: false; error: string };

/** Messages sent from the popup to the content script in a LeetCode tab. */
export type TabMessage = { kind: "leettrack-tab"; type: "open-panel" };
