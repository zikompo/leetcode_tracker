import {
  DEFAULT_SETTINGS,
  getScheduler,
  replayCard,
  resolvePatternIds,
  type Attempt,
  type CardState,
  type CustomList,
  type MockInterview,
  type Difficulty,
  type Problem,
  type Scheduler,
  type Settings,
} from "@leettrack/core";
import { LISTS, SEED_BY_SLUG, listProblems } from "@leettrack/seed";
import type { DataSet, ProblemInfo } from "./types";

/** Everything the scheduler-backed views need, computed once per request. */
export interface Snapshot {
  problems: readonly Problem[];
  attempts: readonly Attempt[];
  settings: Settings;
  customLists: readonly CustomList[];
  /** Mock interviews, newest first; deleted ones left out. */
  mocks: readonly MockInterview[];
  scheduler: Scheduler;
  /** Each problem's attempts, oldest first. */
  bySlug: Map<string, Attempt[]>;
  problemMap: Map<string, Problem>;
  cards: Map<string, CardState>;
  now: Date;
  /** Confirmed and suggested patterns for any problem (seed-only ones included), merges applied. */
  patternsOf(slug: string): { patterns: string[]; suggestedPatterns: string[] };
  info(slug: string): ProblemInfo;
}

const byEnded = (a: Attempt, b: Attempt) => a.endedAt.localeCompare(b.endedAt);

export function groupBySlug(attempts: readonly Attempt[]): Map<string, Attempt[]> {
  const out = new Map<string, Attempt[]>();
  for (const a of attempts) out.set(a.problemSlug, [...(out.get(a.problemSlug) ?? []), a]);
  for (const list of out.values()) list.sort(byEnded);
  return out;
}

export function buildSnapshot(data: DataSet, now: Date = new Date()): Snapshot {
  // Settings saved before M2 lack the newer fields.
  const settings: Settings = { ...DEFAULT_SETTINGS, ...data.settings };
  const scheduler = getScheduler(settings.desiredRetention);
  const bySlug = groupBySlug(data.attempts);
  const problemMap = new Map(data.problems.map((p) => [p.slug, p]));
  const cards = new Map<string, CardState>();
  for (const [slug, list] of bySlug) {
    const card = replayCard(slug, list, scheduler);
    if (card) cards.set(slug, card);
  }
  const merges = settings.patternMerges ?? {};
  return {
    problems: data.problems,
    attempts: data.attempts,
    settings,
    customLists: (data.customLists ?? []).filter((l) => !l.deleted),
    mocks: (data.mocks ?? [])
      .filter((m) => !m.deleted)
      .sort((a, b) => b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt)),
    scheduler,
    bySlug,
    problemMap,
    cards,
    now,
    patternsOf(slug) {
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
    },
    info(slug) {
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
    },
  };
}

export interface ResolvedList {
  id: string;
  name: string;
  kind: "seed" | "custom";
  slugs: string[];
}

/** Seed lists then the user's own, in display order. */
export function allLists(snap: Pick<Snapshot, "customLists">): ResolvedList[] {
  return [
    ...LISTS.map((l) => ({
      id: l.id,
      name: l.name,
      kind: "seed" as const,
      slugs: listProblems(l.id).map((p) => p.slug),
    })),
    ...snap.customLists.map((l) => ({
      id: l.id,
      name: l.name,
      kind: "custom" as const,
      slugs: l.slugs,
    })),
  ];
}

/** Slugs of a list by id (seed or custom), or none if it no longer exists. */
export function listSlugs(snap: Pick<Snapshot, "customLists">, id: string): string[] {
  return allLists(snap).find((l) => l.id === id)?.slugs ?? [];
}
