import {
  DEFAULT_SETTINGS,
  addCustomPattern,
  buildExport,
  buildQueue,
  computeMastery,
  deriveStatus,
  effectivePatterns,
  getScheduler,
  isLeech,
  masteryInsights,
  medianSolveSeconds,
  mergeAttempts,
  mergeProblems,
  mergeSettings,
  parseExport,
  quickReviewEligible,
  replayCard,
  resolvePatternId,
  resolvePatternIds,
  retrievability,
  type Attempt,
  type CardState,
  type Difficulty,
  type MasteryProblem,
  type Problem,
  type ProblemStatus,
  type Queue,
  type ReviewSource,
  type Scheduler,
  type Settings,
} from "@leettrack/core";
import { LISTS, PATTERNS, SEED_BY_SLUG, listProblems, patternsFromTopics } from "@leettrack/seed";
import type { ProblemMetadata } from "../adapters/leetcode";
import type { Repo, SessionStore } from "./repo";
import type {
  Api,
  CardSummary,
  Dashboard,
  ImportSummary,
  LeechInfo,
  ListProgress,
  ProblemState,
  Stats,
} from "./types";

const BUILTIN_PATTERN_IDS: ReadonlySet<string> = new Set(PATTERNS.map((p) => p.id));
const STATUSES: ProblemStatus[] = [
  "unseen",
  "in_progress",
  "solved_with_help",
  "fully_solved",
  "mastered",
];

/** The data side of the API; complexity suggestions live in lib/ai. */
type DataApi = Omit<Api, "getAiStatus" | "analyzeComplexity">;
type AsyncApi = {
  [K in keyof DataApi]: (...args: Parameters<DataApi[K]>) => Promise<ReturnType<DataApi[K]>>;
};

const byEnded = (a: Attempt, b: Attempt) => a.endedAt.localeCompare(b.endedAt);
const endOfLocalDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);

function groupBySlug(attempts: readonly Attempt[]): Map<string, Attempt[]> {
  const out = new Map<string, Attempt[]>();
  for (const a of attempts) out.set(a.problemSlug, [...(out.get(a.problemSlug) ?? []), a]);
  for (const list of out.values()) list.sort(byEnded);
  return out;
}

interface ProblemInfo {
  title?: string;
  frontendId?: string;
  difficulty?: Difficulty;
}

/** Everything the scheduler-backed views need, loaded once per request. */
interface Snapshot {
  problems: Problem[];
  attempts: Attempt[];
  s: Settings;
  scheduler: Scheduler;
  bySlug: Map<string, Attempt[]>;
  problemMap: Map<string, Problem>;
  cards: Map<string, CardState>;
  now: Date;
  /** Confirmed and suggested patterns for any problem, seed-only ones included. */
  patternsOf(slug: string): { patterns: string[]; suggestedPatterns: string[] };
  info(slug: string): ProblemInfo;
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
    const [problems, attempts, s] = await Promise.all([
      repo.allProblems(),
      repo.allAttempts(),
      settings(),
    ]);
    const scheduler = getScheduler(s.desiredRetention);
    const bySlug = groupBySlug(attempts);
    const problemMap = new Map(problems.map((p) => [p.slug, p]));
    const cards = new Map<string, CardState>();
    for (const [slug, list] of bySlug) {
      const card = replayCard(slug, list, scheduler);
      if (card) cards.set(slug, card);
    }
    const now = clock();
    const merges = s.patternMerges ?? {};
    const patternsOf = (slug: string) => {
      const p = problemMap.get(slug);
      return {
        patterns: resolvePatternIds(p?.patterns ?? [], merges),
        suggestedPatterns: resolvePatternIds(
          p?.suggestedPatterns.length
            ? p.suggestedPatterns
            : (SEED_BY_SLUG.get(slug)?.suggestedPatterns ?? []),
          merges,
        ),
      };
    };
    const info = (slug: string): ProblemInfo => {
      const p = problemMap.get(slug);
      const seed = SEED_BY_SLUG.get(slug);
      const title = p?.title || seed?.title;
      const frontendId = p?.frontendId || seed?.frontendId;
      const difficulty: Difficulty | undefined = p?.difficulty ?? seed?.difficulty;
      return {
        ...(title ? { title } : {}),
        ...(frontendId ? { frontendId } : {}),
        ...(difficulty ? { difficulty } : {}),
      };
    };
    return { problems, attempts, s, scheduler, bySlug, problemMap, cards, now, patternsOf, info };
  }

  function cardSummary(snap: Snapshot, slug: string): CardSummary | undefined {
    const card = snap.cards.get(slug);
    if (!card) return undefined;
    const attempts = snap.bySlug.get(slug) ?? [];
    return {
      due: card.due,
      state: card.state,
      stabilityDays: card.stability,
      retrievability: retrievability(card, snap.now, snap.scheduler),
      reps: card.reps,
      lapses: card.lapses,
      isDue: new Date(card.due) < endOfLocalDay(snap.now),
      isLeech: isLeech(attempts),
      quickEligible: quickReviewEligible(card, attempts),
    };
  }

  async function problemState(slug: string): Promise<ProblemState> {
    const snap = await snapshot();
    const problem = snap.problemMap.get(slug);
    const attempts = [...(snap.bySlug.get(slug) ?? [])].sort((a, b) =>
      a.startedAt.localeCompare(b.startedAt),
    );
    const card = snap.cards.get(slug);
    const state: ProblemState = {
      slug,
      attempts,
      status: deriveStatus(problem, attempts, card?.stability),
      suggestedPatterns: snap.patternsOf(slug).suggestedPatterns,
    };
    const summary = cardSummary(snap, slug);
    if (summary) state.card = summary;
    if (problem) {
      state.problem = problem;
      const history = snap.attempts.flatMap((a) => {
        const difficulty = snap.problemMap.get(a.problemSlug)?.difficulty;
        return difficulty ? [{ difficulty, attempt: a }] : [];
      });
      const median = medianSolveSeconds(history, problem.difficulty);
      if (median !== undefined) state.medianSolveSeconds = median;
    }
    return state;
  }

  function queueFrom(snap: Snapshot): Queue {
    const reviews: ReviewSource[] = [...snap.cards].map(([slug, card]) => ({
      slug,
      card,
      attempts: snap.bySlug.get(slug) ?? [],
      ...snap.info(slug),
      patterns: [...effectivePatterns(snap.patternsOf(slug))],
    }));
    const newCandidates = snap.s.activeLists.flatMap((id) =>
      listProblems(id).map((p) => ({
        slug: p.slug,
        title: p.title,
        frontendId: p.frontendId,
        difficulty: p.difficulty,
        patterns: snap.patternsOf(p.slug).suggestedPatterns,
      })),
    );
    const startedSlugs = new Set([
      ...snap.bySlug.keys(),
      ...snap.problems.filter((p) => p.statusOverride).map((p) => p.slug),
    ]);
    return buildQueue({
      now: snap.now,
      reviews,
      newCandidates,
      startedSlugs,
      attempts: snap.attempts,
      settings: snap.s,
      retrievabilityOf: (card) => retrievability(card, snap.now, snap.scheduler),
    });
  }

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

    async getStats(): Promise<Stats> {
      const snap = await snapshot();
      const slugs = new Set([
        ...snap.bySlug.keys(),
        ...snap.problems.filter((p) => p.statusOverride).map((p) => p.slug),
      ]);
      let fullySolved = 0;
      for (const slug of slugs) {
        const s = deriveStatus(
          snap.problemMap.get(slug),
          snap.bySlug.get(slug) ?? [],
          snap.cards.get(slug)?.stability,
        ).status;
        if (s === "fully_solved" || s === "mastered") fullySolved += 1;
      }
      const queue = queueFrom(snap);
      return {
        problemsAttempted: snap.bySlug.size,
        attempts: snap.attempts.length,
        fullySolved,
        dueToday: queue.items.filter((i) => i.kind === "review").length,
        leeches: [...snap.bySlug.values()].filter((a) => isLeech(a)).length,
      };
    },

    async getQueue() {
      return queueFrom(await snapshot());
    },

    async getDashboard(): Promise<Dashboard> {
      const snap = await snapshot();
      const difficultyOf = (slug: string): Difficulty => snap.info(slug).difficulty ?? "Medium";
      const masteryProblems: MasteryProblem[] = [...snap.bySlug].map(([slug, attempts]) => {
        const card = snap.cards.get(slug);
        return {
          slug,
          difficulty: difficultyOf(slug),
          ...snap.patternsOf(slug),
          attempts,
          ...(card ? { card } : {}),
        };
      });
      const activeSlugs = [...new Set(snap.s.activeLists.flatMap((id) => listProblems(id)))];
      const patterns = computeMastery({
        problems: masteryProblems,
        listProblems: activeSlugs.map((p) => {
          const { patterns, suggestedPatterns } = snap.patternsOf(p.slug);
          return { slug: p.slug, patterns: [...new Set([...patterns, ...suggestedPatterns])] };
        }),
        retrievabilityOf: (card) => retrievability(card, snap.now, snap.scheduler),
      });

      const lists: ListProgress[] = LISTS.map((l) => {
        const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<
          ProblemStatus,
          number
        >;
        const items = listProblems(l.id);
        for (const p of items) {
          const status = deriveStatus(
            snap.problemMap.get(p.slug),
            snap.bySlug.get(p.slug) ?? [],
            snap.cards.get(p.slug)?.stability,
          ).status;
          byStatus[status] += 1;
        }
        return {
          id: l.id,
          name: l.name,
          active: snap.s.activeLists.includes(l.id),
          total: items.length,
          byStatus,
        };
      });

      const leeches: LeechInfo[] = [...snap.bySlug]
        .filter(([, attempts]) => isLeech(attempts))
        .map(([slug, attempts]) => ({
          slug,
          title: snap.info(slug).title ?? slug,
          againCount: attempts.filter((a) => a.rating === 1).length,
          stuckNotes: attempts.flatMap((a) =>
            a.stuckNote ? [{ at: a.endedAt, note: a.stuckNote }] : [],
          ),
        }))
        .sort((a, b) => b.againCount - a.againCount);

      return { patterns, insights: masteryInsights(patterns), lists, leeches };
    },

    async exportData() {
      const [problems, attempts] = await Promise.all([repo.allProblems(), repo.allAttempts()]);
      return JSON.stringify(
        buildExport({ problems, attempts, settings: await settings() }, clock()),
        null,
        2,
      );
    },

    async importData(json: string): Promise<ImportSummary> {
      const parsed = parseExport(json);
      if (!parsed.ok) throw new Error(parsed.error);
      const { data } = parsed;
      const [localAttempts, localProblems] = await Promise.all([
        repo.allAttempts(),
        repo.allProblems(),
      ]);
      const localById = new Map(localAttempts.map((a) => [a.id, a]));
      const mergedAttempts = mergeAttempts(localAttempts, data.attempts);
      const changedAttempts = mergedAttempts.filter((a) => localById.get(a.id) !== a);
      const attemptsAdded = changedAttempts.filter((a) => !localById.has(a.id)).length;
      const localBySlug = new Map(localProblems.map((p) => [p.slug, p]));
      const changedProblems = mergeProblems(localProblems, data.problems).filter(
        (p) => localBySlug.get(p.slug) !== p,
      );
      await repo.putAttempts(changedAttempts);
      await repo.putProblems(changedProblems);
      if (data.settings) await repo.putSettings(mergeSettings(await settings(), data.settings));
      return {
        attemptsAdded,
        attemptsUpdated: changedAttempts.length - attemptsAdded,
        problemsMerged: changedProblems.length,
      };
    },
  };
}

export type Service = ReturnType<typeof createService>;
