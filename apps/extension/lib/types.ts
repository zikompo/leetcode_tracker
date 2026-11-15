import type {
  Attempt,
  Checkpoint,
  CustomList,
  Queue,
  SessionObservation,
  Settings,
  StatusOverride,
} from "@leettrack/core";
import type {
  ConfidenceGauge,
  Countdown,
  Dashboard,
  PatternDetail,
  ProblemState,
  Stats,
} from "@leettrack/insights";
import type { ProblemMetadata } from "../adapters/leetcode";
import type { SyncStatus } from "./account";
import type { AiStatus, AnalysisInput, ComplexitySuggestion } from "./ai";
import type { RepoChoice } from "./github/api";
import type { GitHubStatus } from "./github/service";

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

export type {
  CardSummary,
  Dashboard,
  LeechInfo,
  ListProgress,
  ProblemState,
  Stats,
} from "@leettrack/insights";

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
  /** One pattern's problems and trend, for the dashboard's expandable rows. */
  getPatternDetail(id: string): PatternDetail;
  /** Upcoming interviews, soonest first. */
  getCountdowns(): Countdown[];
  /** Today's work and problems by last rating, for the gauge. */
  getGauge(): ConfidenceGauge;
  renamePattern(input: { id: string; name: string }): Settings;
  /** Fold one pattern into another everywhere; the source disappears from the taxonomy. */
  mergePattern(input: { from: string; into: string }): Settings;
  /** The user's own lists (synced from the website), without deleted ones. */
  getCustomLists(): CustomList[];
  exportData(): string;
  importData(json: string): ImportSummary;
  /** Whether complexity suggestions are set up, and with what. */
  getAiStatus(): AiStatus;
  /** Ask the configured model for a complexity estimate. Sends the code to that provider. */
  analyzeComplexity(input: AnalysisInput): ComplexitySuggestion;
  /** Account and sync state, for the popup and settings. */
  getSyncStatus(): SyncStatus;
  syncNow(): SyncStatus;
  signOut(): SyncStatus;
  /** GitHub sync (spec 8): connection, repo choice, and the commit queue. */
  githubStatus(): GitHubStatus;
  githubStartConnect(): GitHubStatus;
  githubPollConnect(): GitHubStatus & { interval?: number };
  githubListRepos(): RepoChoice[];
  githubSelectRepo(choice: { owner: string; repo: string; branch: string }): GitHubStatus;
  githubSetIncludeNotes(includeNotes: boolean): GitHubStatus;
  githubBackfillCount(): number;
  githubBackfill(): number;
  githubRetryNow(): number;
  githubDisconnect(): GitHubStatus;
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
