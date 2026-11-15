import {
  buildQueue,
  computeMastery,
  deriveStatus,
  effectivePatterns,
  isLeech,
  masteryInsights,
  medianSolveSeconds,
  noNewProblemsFor,
  quickReviewEligible,
  upcomingTargets,
  retrievability,
  type Difficulty,
  type MasteryProblem,
  type ProblemStatus,
  type Queue,
  type ReviewSource,
} from "@leettrack/core";
import { allLists, listSlugs, type Snapshot } from "./snapshot";
import { deadlineReviewOf, targetRemaining } from "./targets";
import type { CardSummary, Dashboard, LeechInfo, ListProgress, ProblemState, Stats } from "./types";

export const STATUSES: ProblemStatus[] = [
  "unseen",
  "in_progress",
  "solved_with_help",
  "fully_solved",
  "mastered",
];

const endOfLocalDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1);

export const recallOf = (snap: Snapshot) => (card: Parameters<typeof retrievability>[0]) =>
  retrievability(card, snap.now, snap.scheduler);

export function statusOf(snap: Snapshot, slug: string): ProblemStatus {
  return deriveStatus(
    snap.problemMap.get(slug),
    snap.bySlug.get(slug) ?? [],
    snap.cards.get(slug)?.stability,
  ).status;
}

export function cardSummary(snap: Snapshot, slug: string): CardSummary | undefined {
  const card = snap.cards.get(slug);
  if (!card) return undefined;
  const attempts = snap.bySlug.get(slug) ?? [];
  const extra = deadlineReviewOf(snap, card);
  const due = extra?.due ?? card.due;
  return {
    due,
    state: card.state,
    stabilityDays: card.stability,
    retrievability: recallOf(snap)(card),
    reps: card.reps,
    lapses: card.lapses,
    isDue: new Date(due) < endOfLocalDay(snap.now),
    isLeech: isLeech(attempts),
    quickEligible: quickReviewEligible(card, attempts),
    ...(extra ? { forTarget: extra.target.label } : {}),
  };
}

export function problemStateFrom(snap: Snapshot, slug: string): ProblemState {
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

/**
 * Today's queue (spec 5.3). New problems come from the upcoming interviews' plans first, then
 * the active lists (seed or custom). Problems that would be shaky on an interview day get an
 * extra review before it, and the last days before one are reviews only (spec 5.5).
 */
export function queueFrom(snap: Snapshot): Queue {
  const reviews: ReviewSource[] = [...snap.cards].map(([slug, card]) => {
    const extra = deadlineReviewOf(snap, card);
    return {
      slug,
      card: extra ? { ...card, due: extra.due } : card,
      attempts: snap.bySlug.get(slug) ?? [],
      ...snap.info(slug),
      patterns: [...effectivePatterns(snap.patternsOf(slug))],
      ...(extra ? { forTarget: extra.target } : {}),
    };
  });
  const targets = upcomingTargets(snap.settings.targetDates, snap.now);
  const newCandidates = [
    ...targets.flatMap((t) => targetRemaining(snap, t)),
    ...snap.settings.activeLists.flatMap((id) =>
      listSlugs(snap, id).map((slug) => {
        const info = snap.info(slug);
        return {
          slug,
          title: info.title ?? slug,
          frontendId: info.frontendId ?? "",
          difficulty: info.difficulty ?? "Medium",
          patterns: snap.patternsOf(slug).suggestedPatterns,
        };
      }),
    ),
  ];
  const startedSlugs = new Set([
    ...snap.bySlug.keys(),
    ...snap.problems.filter((p) => p.statusOverride).map((p) => p.slug),
  ]);
  const noNewFor = noNewProblemsFor(targets, snap.now, snap.settings.targetNoNewDays);
  return buildQueue({
    now: snap.now,
    reviews,
    newCandidates,
    startedSlugs,
    attempts: snap.attempts,
    settings: snap.settings,
    retrievabilityOf: recallOf(snap),
    ...(noNewFor ? { noNewFor } : {}),
  });
}

export function statsFrom(snap: Snapshot): Stats {
  const slugs = new Set([
    ...snap.bySlug.keys(),
    ...snap.problems.filter((p) => p.statusOverride).map((p) => p.slug),
  ]);
  let fullySolved = 0;
  for (const slug of slugs) {
    const s = statusOf(snap, slug);
    if (s === "fully_solved" || s === "mastered") fullySolved += 1;
  }
  return {
    problemsAttempted: snap.bySlug.size,
    attempts: snap.attempts.length,
    fullySolved,
    dueToday: queueFrom(snap).items.filter((i) => i.kind === "review").length,
    leeches: [...snap.bySlug.values()].filter((a) => isLeech(a)).length,
  };
}

export function listProgress(snap: Snapshot): ListProgress[] {
  return allLists(snap).map((l) => {
    const byStatus = Object.fromEntries(STATUSES.map((s) => [s, 0])) as Record<
      ProblemStatus,
      number
    >;
    for (const slug of l.slugs) byStatus[statusOf(snap, slug)] += 1;
    return {
      id: l.id,
      name: l.name,
      kind: l.kind,
      active: snap.settings.activeLists.includes(l.id),
      total: l.slugs.length,
      byStatus,
    };
  });
}

export function leechesFrom(snap: Snapshot): LeechInfo[] {
  return [...snap.bySlug]
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
}

export function masteryFrom(snap: Snapshot) {
  const difficultyOf = (slug: string): Difficulty => snap.info(slug).difficulty ?? "Medium";
  const problems: MasteryProblem[] = [...snap.bySlug].map(([slug, attempts]) => {
    const card = snap.cards.get(slug);
    return {
      slug,
      difficulty: difficultyOf(slug),
      ...snap.patternsOf(slug),
      attempts,
      ...(card ? { card } : {}),
    };
  });
  const activeSlugs = [...new Set(snap.settings.activeLists.flatMap((id) => listSlugs(snap, id)))];
  return computeMastery({
    problems,
    listProblems: activeSlugs.map((slug) => {
      const { patterns, suggestedPatterns } = snap.patternsOf(slug);
      return { slug, patterns: [...new Set([...patterns, ...suggestedPatterns])] };
    }),
    retrievabilityOf: recallOf(snap),
  });
}

export function dashboardFrom(snap: Snapshot): Dashboard {
  const patterns = masteryFrom(snap);
  return {
    patterns,
    insights: masteryInsights(patterns),
    lists: listProgress(snap),
    leeches: leechesFrom(snap),
  };
}
