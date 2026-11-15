import type { CustomList } from "@leettrack/core";
import type { SyncBatch, Remote } from "./remote";
import type { Repo } from "./repo";
import { mergeIntoRepo } from "./service";
import type { ImportSummary } from "./types";

/** Bookkeeping kept between syncs (chrome.storage.local in production). */
export interface SyncState {
  /**
   * The version (updatedAt) of each record the server is known to have, by key ("a:<id>",
   * "p:<slug>", "l:<id>", "s"). Anything whose local version differs is pushed. This doesn't
   * depend on clocks, so imported old records and clock changes still sync.
   */
  synced?: Record<string, string>;
  /** Server time of the newest row pulled. */
  cursor?: string | null;
  lastSyncAt?: string;
  lastError?: string;
}

export interface SyncStateStore {
  get(): Promise<SyncState>;
  set(state: SyncState): Promise<void>;
}

export interface SyncResult {
  pushed: number;
  pulled: ImportSummary;
  /** Whether anything local changed, so views (and the badge) need refreshing. */
  changed: boolean;
}

/** At most this many records per request. */
const CHUNK = 500;

function chunks(batch: SyncBatch): SyncBatch[] {
  const n = Math.max(batch.attempts.length, batch.problems.length, batch.lists.length);
  const out: SyncBatch[] = [];
  for (let i = 0; i === 0 || i < n; i += CHUNK) {
    out.push({
      attempts: batch.attempts.slice(i, i + CHUNK),
      problems: batch.problems.slice(i, i + CHUNK),
      lists: batch.lists.slice(i, i + CHUNK),
      ...(i === 0 && batch.settings ? { settings: batch.settings } : {}),
    });
  }
  return out;
}

/**
 * Two-way sync (spec 9.3): push local records the server doesn't have yet, then pull server
 * rows changed since the cursor and merge them (attempts by union, the rest newest-wins).
 * The first sync after sign-in pushes everything, so nothing logged offline is lost.
 */
export function createSync(deps: {
  repo: Repo;
  remote: Remote;
  state: SyncStateStore;
  clock?: () => Date;
}) {
  const clock = deps.clock ?? (() => new Date());

  return {
    async run(): Promise<SyncResult> {
      const state = await deps.state.get();
      const synced = { ...state.synced };
      const unsynced = (key: string, x: { updatedAt: string }) => synced[key] !== x.updatedAt;
      try {
        const [attempts, problems, settings, lists] = await Promise.all([
          deps.repo.allAttempts(),
          deps.repo.allProblems(),
          deps.repo.getSettings(),
          deps.repo.getCustomLists(),
        ]);
        const batch: SyncBatch = {
          attempts: attempts.filter((a) => unsynced(`a:${a.id}`, a)),
          problems: problems.filter((p) => unsynced(`p:${p.slug}`, p)),
          lists: lists.filter((l) => unsynced(`l:${l.id}`, l)),
          ...(settings && unsynced("s", settings) ? { settings } : {}),
        };
        const pushed =
          batch.attempts.length +
          batch.problems.length +
          batch.lists.length +
          (batch.settings ? 1 : 0);
        if (pushed > 0) for (const part of chunks(batch)) await deps.remote.push(part);
        // The server now has at least these versions (it keeps whichever is newer).
        batch.attempts.forEach((a) => (synced[`a:${a.id}`] = a.updatedAt));
        batch.problems.forEach((p) => (synced[`p:${p.slug}`] = p.updatedAt));
        batch.lists.forEach((l) => (synced[`l:${l.id}`] = l.updatedAt));
        if (batch.settings) synced.s = batch.settings.updatedAt;

        const pulled = await deps.remote.pull(state.cursor ?? null);
        const settingsBefore = JSON.stringify(await deps.repo.getSettings());
        const listsBefore = JSON.stringify(await deps.repo.getCustomLists());
        const summary = await mergeIntoRepo(deps.repo, {
          attempts: pulled.attempts,
          problems: pulled.problems,
          customLists: pulled.lists as CustomList[],
          ...(pulled.settings ? { settings: pulled.settings } : {}),
        });
        const changed =
          summary.attemptsAdded + summary.attemptsUpdated + summary.problemsMerged > 0 ||
          JSON.stringify(await deps.repo.getSettings()) !== settingsBefore ||
          JSON.stringify(await deps.repo.getCustomLists()) !== listsBefore;

        // What came down is what the server has; don't send it straight back.
        pulled.attempts.forEach((a) => (synced[`a:${a.id}`] = a.updatedAt));
        pulled.problems.forEach((p) => (synced[`p:${p.slug}`] = p.updatedAt));
        pulled.lists.forEach((l) => (synced[`l:${l.id}`] = l.updatedAt));
        if (pulled.settings) synced.s = pulled.settings.updatedAt;

        await deps.state.set({
          synced,
          cursor: pulled.cursor ?? state.cursor ?? null,
          lastSyncAt: clock().toISOString(),
        });
        return { pushed, pulled: summary, changed };
      } catch (err) {
        await deps.state.set({
          ...state,
          lastError: err instanceof Error ? err.message : String(err),
        });
        throw err;
      }
    },
  };
}

export function memorySyncState(initial: SyncState = {}): SyncStateStore {
  let s = initial;
  return {
    get: async () => s,
    set: async (next) => {
      s = next;
    },
  };
}
