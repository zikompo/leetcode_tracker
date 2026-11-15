import type { Difficulty, Outcome, ProblemStatus } from "@leettrack/core";
import { allLists, type Snapshot } from "./snapshot";
import { cardSummary, statusOf } from "./views";

/** One row of the website's Problems table. */
export interface ProblemRow {
  slug: string;
  title: string;
  frontendId?: string;
  difficulty?: Difficulty;
  status: ProblemStatus;
  /** Confirmed patterns, or the suggestions once the problem has been attempted. */
  patterns: string[];
  lists: string[];
  attempts: number;
  lastAttempted?: string;
  nextDue?: string;
  bestOutcome?: Outcome;
  isLeech: boolean;
}

const OUTCOME_RANK: Record<Outcome, number> = {
  not_solved: 0,
  solved_with_help: 1,
  solved_independently: 2,
};

/** Every problem with attempts or a manual status, plus every problem in an active list. */
export function problemRows(snap: Snapshot): ProblemRow[] {
  const lists = allLists(snap);
  const listsOf = (slug: string) => lists.filter((l) => l.slugs.includes(slug)).map((l) => l.id);
  const slugs = new Set<string>([
    ...snap.bySlug.keys(),
    ...snap.problems.filter((p) => p.statusOverride).map((p) => p.slug),
    ...lists.filter((l) => snap.settings.activeLists.includes(l.id)).flatMap((l) => l.slugs),
  ]);
  return [...slugs].map((slug) => {
    const attempts = snap.bySlug.get(slug) ?? [];
    const { patterns, suggestedPatterns } = snap.patternsOf(slug);
    const card = cardSummary(snap, slug);
    const info = snap.info(slug);
    const best = attempts.reduce<Outcome | undefined>(
      (b, a) => (b === undefined || OUTCOME_RANK[a.outcome] > OUTCOME_RANK[b] ? a.outcome : b),
      undefined,
    );
    const last = attempts.at(-1);
    return {
      slug,
      title: info.title ?? slug,
      ...(info.frontendId ? { frontendId: info.frontendId } : {}),
      ...(info.difficulty ? { difficulty: info.difficulty } : {}),
      status: statusOf(snap, slug),
      // Suggestions are spoilers until there's an attempt.
      patterns: patterns.length ? patterns : attempts.length ? suggestedPatterns : [],
      lists: listsOf(slug),
      attempts: attempts.length,
      ...(last ? { lastAttempted: last.endedAt } : {}),
      ...(card ? { nextDue: card.due } : {}),
      ...(best ? { bestOutcome: best } : {}),
      isLeech: card?.isLeech ?? false,
    };
  });
}
