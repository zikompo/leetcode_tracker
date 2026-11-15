import { CONFIG } from "./config";
import type { Attempt, CardState, Difficulty, Settings, TargetDate } from "./types";

const DAY_MS = 86_400_000;
const startOfLocalDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** Problems rated Again this often keep failing on one misunderstanding (spec 5.6). */
export function isLeech(attempts: readonly Pick<Attempt, "rating">[]): boolean {
  return attempts.filter((a) => a.rating === 1).length >= CONFIG.leechAgainCount;
}

/**
 * Quick reviews (spec 5.4) are for mature cards of problems already solved independently
 * in a full attempt.
 */
export function quickReviewEligible(
  card: Pick<CardState, "stability"> | undefined,
  attempts: readonly Pick<Attempt, "outcome" | "kind">[],
): boolean {
  return (
    !!card &&
    card.stability >= CONFIG.quickReviewStabilityDays &&
    attempts.some((a) => a.kind === "full" && a.outcome === "solved_independently")
  );
}

/** A problem that could be started today, from the active lists in priority order. */
export interface NewCandidate {
  slug: string;
  title: string;
  frontendId: string;
  difficulty: Difficulty;
  /** Used only to interleave; never shown before an attempt. */
  patterns: string[];
}

export interface ReviewSource {
  slug: string;
  card: CardState;
  attempts: readonly Attempt[];
  title?: string;
  frontendId?: string;
  difficulty?: Difficulty;
  patterns: string[];
  /** Brought forward for this interview (spec 5.5); `card.due` is then the earlier date. */
  forTarget?: TargetDate;
}

export interface QueueItem {
  slug: string;
  kind: "review" | "new";
  title?: string;
  frontendId?: string;
  difficulty?: Difficulty;
  /** Reviews only. */
  due?: string;
  /** 0 = due today. */
  overdueDays: number;
  retrievability?: number;
  failedLast: boolean;
  quickEligible: boolean;
  isLeech: boolean;
  patterns: string[];
  /** An extra review before this interview. */
  forTarget?: { id: string; label: string; date: string };
}

export interface Queue {
  items: QueueItem[];
  /** Reviews due today before the daily limit was applied. */
  reviewsDue: number;
  reviewsDoneToday: number;
  newDoneToday: number;
  /** No new problems today: this interview is too close (spec 5.5). */
  noNewFor?: { id: string; label: string; date: string };
}

export interface QueueInput {
  now: Date;
  reviews: readonly ReviewSource[];
  newCandidates: readonly NewCandidate[];
  /** Every problem that has attempts or a manual status: never offered as new. */
  startedSlugs: ReadonlySet<string>;
  /** All attempts, to count what was already done today. */
  attempts: readonly Pick<Attempt, "problemSlug" | "endedAt">[];
  settings: Pick<Settings, "dailyNewLimit" | "dailyReviewLimit">;
  retrievabilityOf(card: CardState): number;
  /** Set when an interview is close enough that only reviews are offered. */
  noNewFor?: TargetDate;
}

const targetRef = (t: TargetDate) => ({ id: t.id, label: t.label, date: t.date });

/** Reorder so no more than `maxRun` items in a row share a primary pattern, where possible. */
export function interleave<T extends { patterns: string[] }>(
  items: readonly T[],
  maxRun: number = CONFIG.maxSamePatternRun,
  tail: readonly T[] = [],
): T[] {
  const out: T[] = [];
  const remaining = [...items];
  const primary = (x: T) => x.patterns[0];
  const wouldRun = (x: T) => {
    const p = primary(x);
    if (!p) return false;
    const recent = [...tail, ...out].slice(-maxRun);
    return recent.length === maxRun && recent.every((r) => primary(r) === p);
  };
  while (remaining.length > 0) {
    const i = remaining.findIndex((x) => !wouldRun(x));
    out.push(...remaining.splice(i === -1 ? 0 : i, 1));
  }
  return out;
}

/** The daily queue (spec 5.3): overdue, then due today, then new; limited and interleaved. */
export function buildQueue(input: QueueInput): Queue {
  const today = startOfLocalDay(input.now);
  const tomorrow = addDays(today, 1);

  // Work already done today counts against the limits.
  const firstAttempt = new Map<string, string>();
  const doneToday = new Set<string>();
  for (const a of input.attempts) {
    const prev = firstAttempt.get(a.problemSlug);
    if (!prev || a.endedAt < prev) firstAttempt.set(a.problemSlug, a.endedAt);
    if (new Date(a.endedAt) >= today) doneToday.add(a.problemSlug);
  }
  let newDoneToday = 0;
  let reviewsDoneToday = 0;
  for (const slug of doneToday) {
    if (new Date(firstAttempt.get(slug)!) >= today) newDoneToday += 1;
    else reviewsDoneToday += 1;
  }

  const due: QueueItem[] = input.reviews
    .filter((r) => new Date(r.card.due) < tomorrow)
    .map((r) => {
      const last = [...r.attempts].sort((a, b) => a.endedAt.localeCompare(b.endedAt)).at(-1);
      return {
        slug: r.slug,
        kind: "review" as const,
        ...(r.title ? { title: r.title } : {}),
        ...(r.frontendId ? { frontendId: r.frontendId } : {}),
        ...(r.difficulty ? { difficulty: r.difficulty } : {}),
        due: r.card.due,
        overdueDays: Math.max(
          0,
          Math.round((today.getTime() - startOfLocalDay(new Date(r.card.due)).getTime()) / DAY_MS),
        ),
        retrievability: input.retrievabilityOf(r.card),
        failedLast: last?.rating === 1,
        quickEligible: quickReviewEligible(r.card, r.attempts),
        isLeech: isLeech(r.attempts),
        patterns: r.patterns,
        ...(r.forTarget ? { forTarget: targetRef(r.forTarget) } : {}),
      };
    });

  // Over the limit: keep failed-last-time first, then the least likely to be remembered.
  const reviewCap = Math.max(0, input.settings.dailyReviewLimit - reviewsDoneToday);
  const kept =
    due.length <= reviewCap
      ? due
      : [...due]
          .sort(
            (a, b) =>
              Number(b.failedLast) - Number(a.failedLast) ||
              (a.retrievability ?? 0) - (b.retrievability ?? 0),
          )
          .slice(0, reviewCap);
  const reviews = [...kept].sort(
    (a, b) => b.overdueDays - a.overdueDays || a.due!.localeCompare(b.due!),
  );

  const newCap = input.noNewFor ? 0 : Math.max(0, input.settings.dailyNewLimit - newDoneToday);
  const seen = new Set<string>();
  const fresh: QueueItem[] = [];
  for (const c of input.newCandidates) {
    if (fresh.length >= newCap) break;
    if (input.startedSlugs.has(c.slug) || seen.has(c.slug)) continue;
    seen.add(c.slug);
    fresh.push({
      slug: c.slug,
      kind: "new",
      title: c.title,
      frontendId: c.frontendId,
      difficulty: c.difficulty,
      overdueDays: 0,
      failedLast: false,
      quickEligible: false,
      isLeech: false,
      patterns: c.patterns,
    });
  }

  const orderedReviews = interleave(reviews);
  return {
    items: [...orderedReviews, ...interleave(fresh, CONFIG.maxSamePatternRun, orderedReviews)],
    reviewsDue: due.length,
    reviewsDoneToday,
    newDoneToday,
    ...(input.noNewFor ? { noNewFor: targetRef(input.noNewFor) } : {}),
  };
}
