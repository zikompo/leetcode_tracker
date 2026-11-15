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

/** One row of the review queue page. */
export interface ReviewRow {
  slug: string;
  title: string;
  frontendId?: string;
  difficulty?: Difficulty;
  /** When it's due, interview extras and snoozes applied. */
  due: string;
  isDue: boolean;
  /** Chance of recalling it now, 0 to 1. */
  retrievability: number;
  /** Due date set by hand (snoozed or rescheduled), still in force. */
  manual: boolean;
  /** Brought forward for this interview. */
  forTarget?: string;
  isLeech: boolean;
}

/** Reviews due now or within `days` days, soonest first (spec 7.1, page 2). */
export function upcomingReviews(snap: Snapshot, days = 14): ReviewRow[] {
  const horizon = new Date(
    snap.now.getFullYear(),
    snap.now.getMonth(),
    snap.now.getDate() + days + 1,
  );
  const rows: ReviewRow[] = [];
  for (const [slug, card] of snap.cards) {
    const summary = cardSummary(snap, slug);
    if (!summary || new Date(summary.due) >= horizon) continue;
    const info = snap.info(slug);
    const override = snap.problemMap.get(slug)?.dueOverride;
    rows.push({
      slug,
      title: info.title ?? slug,
      ...(info.frontendId ? { frontendId: info.frontendId } : {}),
      ...(info.difficulty ? { difficulty: info.difficulty } : {}),
      due: summary.due,
      isDue: summary.isDue,
      retrievability: summary.retrievability,
      manual: !!override && card.due === override.due,
      ...(summary.forTarget ? { forTarget: summary.forTarget } : {}),
      isLeech: summary.isLeech,
    });
  }
  return rows.sort((a, b) => a.due.localeCompare(b.due) || a.retrievability - b.retrievability);
}
