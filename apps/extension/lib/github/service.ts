import { DEFAULT_SETTINGS, resolvePatternIds, type Settings } from "@leettrack/core";
import { patternName } from "@leettrack/insights";
import { SEED_BY_SLUG } from "@leettrack/seed";
import type { Repo } from "../repo";
import {
  GitHubError,
  type DeviceCode,
  type GitHubApi,
  type GitHubToken,
  type RepoChoice,
} from "./api";
import { filesForAttempt, shouldCommit } from "./render";

export interface StoredToken extends GitHubToken {
  login: string;
}

/** A commit still to make, retried with backoff until it lands (spec 8.2). */
export interface CommitJob {
  attemptId: string;
  tries: number;
  nextAt: string;
  lastError?: string;
}

export interface GitHubLocalState {
  lastCommitAt?: string;
  lastError?: string;
  /** The token stopped working; the user has to connect again. */
  needsReconnect?: boolean;
}

/** What lives only in this browser (chrome.storage.local in production). */
export interface GitHubStore {
  getToken(): Promise<StoredToken | null>;
  setToken(token: StoredToken | null): Promise<void>;
  getPending(): Promise<DeviceCode | null>;
  setPending(code: DeviceCode | null): Promise<void>;
  getQueue(): Promise<CommitJob[]>;
  setQueue(jobs: CommitJob[]): Promise<void>;
  /** Attempt ids already committed. */
  getDone(): Promise<string[]>;
  setDone(ids: string[]): Promise<void>;
  getState(): Promise<GitHubLocalState>;
  setState(state: GitHubLocalState): Promise<void>;
}

export interface GitHubStatus {
  /** False when this build has no GitHub App configured. */
  configured: boolean;
  connected: boolean;
  login?: string;
  /** Where commits go (synced with the account). */
  target?: NonNullable<Settings["github"]>;
  pending: number;
  lastCommitAt?: string;
  lastError?: string;
  needsReconnect: boolean;
  /** Where to install the App on a repo. */
  installUrl?: string;
  /** While connecting: the code to enter on GitHub. */
  deviceCode?: { userCode: string; verificationUri: string; expiresAt: string };
}

/** Minutes to wait before each retry. */
const BACKOFF_MIN = [1, 5, 30, 120, 360];
const REFRESH_MARGIN_MS = 5 * 60_000;

export function createGitHub(deps: {
  repo: Repo;
  store: GitHubStore;
  /** Null when no GitHub App is configured in this build. */
  api: GitHubApi | null;
  appSlug?: string;
  getSettings(): Promise<Settings>;
  setSettings(patch: Partial<Omit<Settings, "updatedAt">>): Promise<Settings>;
  clock?: () => Date;
}) {
  const clock = deps.clock ?? (() => new Date());
  const { store } = deps;
  let running: Promise<number> | null = null;

  const needApi = () => {
    if (!deps.api) throw new GitHubError("GitHub isn't set up in this build of LeetTrack.");
    return deps.api;
  };

  /** A token that's good for a while, refreshed when close to expiring. */
  async function validToken(): Promise<StoredToken> {
    const token = await store.getToken();
    if (!token) throw new GitHubError("Connect GitHub first.", 401, true);
    const expiring =
      token.expiresAt && Date.parse(token.expiresAt) - clock().getTime() < REFRESH_MARGIN_MS;
    if (!expiring) return token;
    if (!token.refreshToken)
      throw new GitHubError("GitHub sign-in expired. Connect again.", 401, true);
    try {
      const fresh = { ...(await needApi().refresh(token.refreshToken)), login: token.login };
      await store.setToken(fresh);
      return fresh;
    } catch (err) {
      if (err instanceof GitHubError && err.auth)
        await store.setState({ ...(await store.getState()), needsReconnect: true });
      throw err;
    }
  }

  async function status(): Promise<GitHubStatus> {
    const [token, queue, state, settings, pending] = await Promise.all([
      store.getToken(),
      store.getQueue(),
      store.getState(),
      deps.getSettings(),
      store.getPending(),
    ]);
    return {
      configured: deps.api !== null,
      connected: token !== null && !state.needsReconnect,
      ...(token ? { login: token.login } : {}),
      ...(settings.github ? { target: settings.github } : {}),
      pending: queue.length,
      ...(state.lastCommitAt ? { lastCommitAt: state.lastCommitAt } : {}),
      ...(state.lastError ? { lastError: state.lastError } : {}),
      needsReconnect: state.needsReconnect ?? false,
      ...(deps.appSlug
        ? { installUrl: `https://github.com/apps/${deps.appSlug}/installations/new` }
        : {}),
      ...(pending && Date.parse(pending.expiresAt) > clock().getTime()
        ? {
            deviceCode: {
              userCode: pending.userCode,
              verificationUri: pending.verificationUri,
              expiresAt: pending.expiresAt,
            },
          }
        : {}),
    };
  }

  async function enqueue(ids: string[]): Promise<number> {
    const [queue, done] = await Promise.all([store.getQueue(), store.getDone()]);
    const skip = new Set([...done, ...queue.map((j) => j.attemptId)]);
    const now = clock().toISOString();
    const added = ids
      .filter((id) => !skip.has(id))
      .map((attemptId) => ({ attemptId, tries: 0, nextAt: now }));
    if (added.length) await store.setQueue([...queue, ...added]);
    return added.length;
  }

  /** Make every due commit; returns how many landed. Never throws: errors are recorded. */
  async function processQueue(): Promise<number> {
    const settings = { ...DEFAULT_SETTINGS, ...(await deps.getSettings()) };
    const target = settings.github;
    if (!deps.api || !target || !(await store.getToken())) return 0;
    const state = await store.getState();
    if (state.needsReconnect) return 0;
    let landed = 0;
    for (;;) {
      const now = clock();
      const queue = await store.getQueue();
      const job = queue
        .filter((j) => Date.parse(j.nextAt) <= now.getTime())
        .sort((a, b) => a.nextAt.localeCompare(b.nextAt))[0];
      if (!job) return landed;
      const drop = async () =>
        store.setQueue((await store.getQueue()).filter((j) => j.attemptId !== job.attemptId));
      try {
        const attempts = await deps.repo.allAttempts();
        const attempt = attempts.find((a) => a.id === job.attemptId);
        if (!attempt || !shouldCommit(attempt)) {
          await drop();
          continue;
        }
        const problem = await deps.repo.getProblem(attempt.problemSlug);
        const seed = SEED_BY_SLUG.get(attempt.problemSlug);
        const token = await validToken();
        const { message, files } = filesForAttempt({
          problem: {
            slug: attempt.problemSlug,
            title: problem?.title || seed?.title || attempt.problemSlug,
            ...(problem?.frontendId || seed?.frontendId
              ? { frontendId: (problem?.frontendId || seed?.frontendId)! }
              : {}),
            ...((problem?.difficulty ?? seed?.difficulty)
              ? { difficulty: problem?.difficulty ?? seed?.difficulty }
              : {}),
            patterns: resolvePatternIds(problem?.patterns ?? [], settings.patternMerges),
          },
          attempts: attempts.filter((a) => a.problemSlug === attempt.problemSlug),
          attempt,
          includeNotes: target.includeNotes,
          patternName: (id) => patternName(id, settings),
        });
        await deps.api.commitFiles(token.accessToken, target, message, files);
        await drop();
        await store.setDone([...(await store.getDone()), attempt.id]);
        const { lastError: _gone, ...rest } = await store.getState();
        await store.setState({ ...rest, lastCommitAt: clock().toISOString() });
        landed += 1;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const auth = err instanceof GitHubError && err.auth;
        const tries = job.tries + 1;
        const wait = BACKOFF_MIN[Math.min(tries, BACKOFF_MIN.length) - 1]! * 60_000;
        await store.setQueue(
          (await store.getQueue()).map((j) =>
            j.attemptId === job.attemptId
              ? {
                  ...j,
                  tries,
                  lastError: message,
                  nextAt: new Date(now.getTime() + wait).toISOString(),
                }
              : j,
          ),
        );
        await store.setState({
          ...(await store.getState()),
          lastError: message,
          ...(auth ? { needsReconnect: true } : {}),
        });
        if (auth) return landed;
      }
    }
  }

  return {
    status,

    async startConnect(): Promise<GitHubStatus> {
      await store.setPending(await needApi().startDeviceFlow());
      return status();
    },

    /** Called by the settings page every few seconds while the user approves on GitHub. */
    async pollConnect(): Promise<GitHubStatus & { interval?: number }> {
      const pending = await store.getPending();
      if (!pending) return status();
      const result = await needApi()
        .pollDeviceFlow(pending.deviceCode)
        .catch(async (err) => {
          await store.setPending(null);
          throw err;
        });
      if (result.status === "pending") {
        return { ...(await status()), ...(result.interval ? { interval: result.interval } : {}) };
      }
      const login = await needApi().login(result.token.accessToken);
      await store.setToken({ ...result.token, login });
      await store.setPending(null);
      const { needsReconnect: _n, lastError: _e, ...rest } = await store.getState();
      await store.setState(rest);
      return status();
    },

    async listRepos(): Promise<RepoChoice[]> {
      return needApi().listRepos((await validToken()).accessToken);
    },

    async selectRepo(choice: {
      owner: string;
      repo: string;
      branch: string;
    }): Promise<GitHubStatus> {
      const current = (await deps.getSettings()).github;
      await deps.setSettings({
        github: { ...choice, includeNotes: current?.includeNotes ?? true },
      });
      return status();
    },

    async setIncludeNotes(includeNotes: boolean): Promise<GitHubStatus> {
      const current = (await deps.getSettings()).github;
      if (current) await deps.setSettings({ github: { ...current, includeNotes } });
      return status();
    },

    /** Queue a just-saved attempt if it should be committed. */
    /**
     * Queue a just-saved attempt if it should be committed. Queued even before a repo is
     * chosen, so a solution saved in between commits once there is one.
     */
    async onAttemptSaved(attemptId: string): Promise<boolean> {
      if (!deps.api || !(await store.getToken())) return false;
      const attempt = (await deps.repo.allAttempts()).find((a) => a.id === attemptId);
      if (!attempt || !shouldCommit(attempt)) return false;
      return (await enqueue([attemptId])) > 0;
    },

    /** Queue every past Accepted attempt not yet committed. */
    async backfill(): Promise<number> {
      const ids = (await deps.repo.allAttempts()).filter(shouldCommit).map((a) => a.id);
      return enqueue(ids);
    },

    /** Count of past Accepted attempts not yet committed or queued. */
    async backfillCount(): Promise<number> {
      const [attempts, done, queue] = await Promise.all([
        deps.repo.allAttempts(),
        store.getDone(),
        store.getQueue(),
      ]);
      const skip = new Set([...done, ...queue.map((j) => j.attemptId)]);
      return attempts.filter((a) => shouldCommit(a) && !skip.has(a.id)).length;
    },

    /** Run the queue now (one at a time). */
    async process(): Promise<number> {
      running ??= processQueue().finally(() => {
        running = null;
      });
      return running;
    },

    /** Retry everything now, ignoring backoff. */
    async retryNow(): Promise<number> {
      const now = clock().toISOString();
      await store.setQueue((await store.getQueue()).map((j) => ({ ...j, nextAt: now })));
      const { needsReconnect: _n, ...rest } = await store.getState();
      await store.setState(rest);
      return this.process();
    },

    /** Forget the token in this browser. The queue stays for when you reconnect. */
    async disconnect(): Promise<GitHubStatus> {
      await store.setToken(null);
      await store.setPending(null);
      return status();
    },
  };
}

export type GitHubService = ReturnType<typeof createGitHub>;

export function memoryGitHubStore(): GitHubStore {
  let token: StoredToken | null = null;
  let pending: DeviceCode | null = null;
  let queue: CommitJob[] = [];
  let done: string[] = [];
  let state: GitHubLocalState = {};
  return {
    getToken: async () => token,
    setToken: async (t) => void (token = t),
    getPending: async () => pending,
    setPending: async (p) => void (pending = p),
    getQueue: async () => queue,
    setQueue: async (q) => void (queue = q),
    getDone: async () => done,
    setDone: async (d) => void (done = d),
    getState: async () => state,
    setState: async (s) => void (state = s),
  };
}
