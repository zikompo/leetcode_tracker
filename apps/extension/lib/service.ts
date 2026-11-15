import {
  DEFAULT_SETTINGS,
  addCustomPattern,
  buildExport,
  mergeAttempts,
  mergeCustomLists,
  mergeProblems,
  mergeSettings,
  parseExport,
  resolvePatternId,
  resolvePatternIds,
  type Attempt,
  type CustomList,
  type Problem,
  type Settings,
} from "@leettrack/core";
import {
  buildSnapshot,
  dashboardFrom,
  problemStateFrom,
  queueFrom,
  statsFrom,
  type Snapshot,
} from "@leettrack/insights";
import { PATTERNS, SEED_BY_SLUG, patternsFromTopics } from "@leettrack/seed";
import type { ProblemMetadata } from "../adapters/leetcode";
import type { Repo, SessionStore } from "./repo";
import type { Api, ImportSummary } from "./types";

const BUILTIN_PATTERN_IDS: ReadonlySet<string> = new Set(PATTERNS.map((p) => p.id));

/** The data side of the API; complexity suggestions and sync live elsewhere. */
type DataApi = Omit<
  Api,
  "getAiStatus" | "analyzeComplexity" | "getSyncStatus" | "syncNow" | "signOut"
>;
type AsyncApi = {
  [K in keyof DataApi]: (...args: Parameters<DataApi[K]>) => Promise<ReturnType<DataApi[K]>>;
};

/** Records arriving from an import file or the server. */
export interface IncomingData {
  problems?: readonly Problem[];
  attempts?: readonly Attempt[];
  settings?: Settings;
  customLists?: readonly CustomList[];
}

/**
 * Merge incoming records into local storage (spec 9.3): attempts by union, everything else
 * last-write-wins. Shared by JSON import and sync pulls. Returns what changed.
 */
export async function mergeIntoRepo(repo: Repo, data: IncomingData): Promise<ImportSummary> {
  const [localAttempts, localProblems, localSettings, localLists] = await Promise.all([
    repo.allAttempts(),
    repo.allProblems(),
    repo.getSettings(),
    repo.getCustomLists(),
  ]);
  const localById = new Map(localAttempts.map((a) => [a.id, a]));
  const changedAttempts = mergeAttempts(localAttempts, data.attempts ?? []).filter(
    (a) => localById.get(a.id) !== a,
  );
  const attemptsAdded = changedAttempts.filter((a) => !localById.has(a.id)).length;
  const localBySlug = new Map(localProblems.map((p) => [p.slug, p]));
  const changedProblems = mergeProblems(localProblems, data.problems ?? []).filter(
    (p) => localBySlug.get(p.slug) !== p,
  );
  await repo.putAttempts(changedAttempts);
  await repo.putProblems(changedProblems);
  if (data.settings) {
    const merged = mergeSettings({ ...DEFAULT_SETTINGS, ...localSettings }, data.settings);
    if (merged !== localSettings) await repo.putSettings(merged);
  }
  if (data.customLists?.length) {
    await repo.putCustomLists(mergeCustomLists(localLists, data.customLists));
  }
  return {
    attemptsAdded,
    attemptsUpdated: changedAttempts.length - attemptsAdded,
    problemsMerged: changedProblems.length,
  };
}

/** All background data logic, independent of Chrome APIs so it can be unit tested. */
export function createService(
  repo: Repo,
  sessions: SessionStore,
  clock: () => Date = () => new Date(),
): AsyncApi {
  const nowIso = () => clock().toISOString();

  async function settings(): Promise<Settings> {
    // Settings saved before M2 lack the newer fields.
    return { ...DEFAULT_SETTINGS, ...(await repo.getSettings()) };
  }

  async function snapshot(): Promise<Snapshot> {
    const [problems, attempts, s, customLists] = await Promise.all([
      repo.allProblems(),
      repo.allAttempts(),
      settings(),
      repo.getCustomLists(),
    ]);
    return buildSnapshot({ problems, attempts, settings: s, customLists }, clock());
  }

  const problemState = async (slug: string) => problemStateFrom(await snapshot(), slug);

  function stubProblem(slug: string): Problem {
    const seed = SEED_BY_SLUG.get(slug);
    return {
      slug,
      frontendId: seed?.frontendId ?? "",
      title: seed?.title ?? slug.replace(/-/g, " "),
      difficulty: seed?.difficulty ?? "Medium",
      url: `https://leetcode.com/problems/${slug}/`,
      leetcodeTopics: [],
      patterns: [],
      suggestedPatterns: seed?.suggestedPatterns ?? [],
      lists: seed?.lists ?? [],
      updatedAt: nowIso(),
    };
  }

  return {
    getProblemState: problemState,

    async upsertProblemMeta(meta: ProblemMetadata) {
      const existing = await repo.getProblem(meta.slug);
      const seed = SEED_BY_SLUG.get(meta.slug);
      const next: Problem = {
        ...(existing ?? stubProblem(meta.slug)),
        frontendId: meta.frontendId,
        title: meta.title,
        difficulty: meta.difficulty,
        url: meta.url,
        leetcodeTopics: meta.leetcodeTopics,
        suggestedPatterns: [
          ...new Set([
            ...(seed?.suggestedPatterns ?? []),
            ...patternsFromTopics(meta.leetcodeTopics),
          ]),
        ],
        lists: seed?.lists ?? existing?.lists ?? [],
      };
      const changed =
        JSON.stringify(existing) !== JSON.stringify({ ...next, updatedAt: existing?.updatedAt });
      if (changed) await repo.putProblems([{ ...next, updatedAt: nowIso() }]);
      return problemState(meta.slug);
    },

    async saveAttempt({ attempt, patterns }: { attempt: Attempt; patterns: string[] }) {
      const problem =
        (await repo.getProblem(attempt.problemSlug)) ?? stubProblem(attempt.problemSlug);
      await repo.putAttempts([attempt]);
      // A quick review doesn't touch the tags.
      if (attempt.kind === "full") {
        await repo.putProblems([
          { ...problem, patterns: [...new Set(patterns)], updatedAt: nowIso() },
        ]);
      }
      await sessions.remove(attempt.problemSlug);
      return problemState(attempt.problemSlug);
    },

    async setStatusOverride({ slug, override }) {
      const problem = (await repo.getProblem(slug)) ?? stubProblem(slug);
      const next: Problem = { ...problem, updatedAt: nowIso() };
      if (override) next.statusOverride = override;
      else delete next.statusOverride;
      await repo.putProblems([next]);
      return problemState(slug);
    },

    getSession: (slug) => sessions.get(slug),
    putSession: (session) => sessions.put(session),
    clearSession: (slug) => sessions.remove(slug),

    getSettings: settings,
    async setSettings(patch) {
      const next: Settings = { ...(await settings()), ...patch, updatedAt: nowIso() };
      await repo.putSettings(next);
      return next;
    },

    async getCustomLists() {
      return (await repo.getCustomLists()).filter((l) => !l.deleted);
    },

    async addCustomPattern(name: string) {
      const current = await settings();
      const { patterns, id } = addCustomPattern(
        current.customPatterns ?? [],
        name,
        BUILTIN_PATTERN_IDS,
      );
      const next: Settings = { ...current, customPatterns: patterns, updatedAt: nowIso() };
      if (patterns.length !== (current.customPatterns ?? []).length) await repo.putSettings(next);
      return { id: resolvePatternId(id, current.patternMerges), settings: next };
    },

    async renamePattern({ id, name }) {
      const current = await settings();
      const clean = name.trim().replace(/\s+/g, " ");
      if (!clean) throw new Error("A pattern needs a name.");
      const next: Settings = { ...current, updatedAt: nowIso() };
      if (BUILTIN_PATTERN_IDS.has(id)) {
        next.patternRenames = { ...current.patternRenames, [id]: clean };
      } else {
        const custom = current.customPatterns ?? [];
        if (!custom.some((c) => c.id === id)) throw new Error(`Unknown pattern "${id}".`);
        next.customPatterns = custom.map((c) => (c.id === id ? { ...c, name: clean } : c));
      }
      await repo.putSettings(next);
      return next;
    },

    async mergePattern({ from, into }) {
      const current = await settings();
      const known = (id: string) =>
        BUILTIN_PATTERN_IDS.has(id) || (current.customPatterns ?? []).some((c) => c.id === id);
      const target = resolvePatternId(into, current.patternMerges);
      if (!known(from) || !known(target)) throw new Error("Pick two existing patterns.");
      if (resolvePatternId(from, current.patternMerges) === target) {
        throw new Error("Those are already the same pattern.");
      }
      const merges = { ...current.patternMerges, [from]: target };
      const next: Settings = { ...current, patternMerges: merges, updatedAt: nowIso() };
      await repo.putSettings(next);
      const changed = (await repo.allProblems())
        .filter((p) => p.patterns.includes(from))
        .map((p) => ({
          ...p,
          patterns: resolvePatternIds(p.patterns, merges),
          updatedAt: nowIso(),
        }));
      await repo.putProblems(changed);
      return next;
    },

    getStats: async () => statsFrom(await snapshot()),
    getQueue: async () => queueFrom(await snapshot()),
    getDashboard: async () => dashboardFrom(await snapshot()),

    async exportData() {
      const [problems, attempts, customLists] = await Promise.all([
        repo.allProblems(),
        repo.allAttempts(),
        repo.getCustomLists(),
      ]);
      return JSON.stringify(
        buildExport({ problems, attempts, settings: await settings(), customLists }, clock()),
        null,
        2,
      );
    },

    async importData(json: string): Promise<ImportSummary> {
      const parsed = parseExport(json);
      if (!parsed.ok) throw new Error(parsed.error);
      return mergeIntoRepo(repo, parsed.data);
    },
  };
}

export type Service = ReturnType<typeof createService>;
