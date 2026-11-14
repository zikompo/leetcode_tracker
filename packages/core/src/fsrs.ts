import {
  DEFAULT_MAXIMUM_INTERVAL,
  dateChrono,
  defaultLearningSteps,
  defaultRelearningSteps,
  defineScheduler,
  schedulerDesiredRetentionMiddleware,
  schedulerFuzzingMiddleware,
  schedulerLearningStepsMiddleware,
  schedulerMaximumIntervalMiddleware,
  schedulerMonotonicIntervalMiddleware,
  schedulerScheduledDaysMiddleware,
  schedulerStatsMiddleware,
} from "ts-fsrs";
import { FSRS7Model, migrateFSRS7Parameters } from "ts-fsrs/models/fsrs-7";
import { CONFIG } from "./config";
import type { Attempt, CardState } from "./types";

/**
 * The same scheduler `DefaultScheduler()` builds (FSRS-7 with the standard policies), but with
 * static imports: DefaultScheduler loads its model with `import()`, which Chrome forbids in
 * extension service workers.
 */
const defineFsrs7 = () =>
  defineScheduler({ model: FSRS7Model, chrono: dateChrono }).use(
    schedulerDesiredRetentionMiddleware,
    schedulerFuzzingMiddleware,
    schedulerStatsMiddleware,
    schedulerScheduledDaysMiddleware,
    schedulerLearningStepsMiddleware,
    schedulerMaximumIntervalMiddleware,
    schedulerMonotonicIntervalMiddleware,
  );
let definition: ReturnType<typeof defineFsrs7> | undefined;

function buildScheduler(desiredRetention: number) {
  definition ??= defineFsrs7(); // lazily, so importing core costs nothing until it's used
  return definition.create({
    config: {
      fractionalDays: true,
      weights: migrateFSRS7Parameters(undefined),
      // Learning steps are minutes apart, built for flashcards. A failed LeetCode problem
      // comes back the next day instead (see dueFrom).
      enableShortTerm: false,
      desiredRetention,
      learningSteps: Array.from(defaultLearningSteps),
      relearningSteps: Array.from(defaultRelearningSteps),
      allowModelOverride: true,
      enableFuzz: false,
      maximumInterval: DEFAULT_MAXIMUM_INTERVAL,
    },
  });
}

export type Scheduler = ReturnType<typeof buildScheduler>;
type SchedulerCard = ReturnType<Scheduler["newCard"]>;

const schedulers = new Map<number, Scheduler>();

/** One scheduler per desired retention, reused. */
export function getScheduler(desiredRetention: number = CONFIG.desiredRetention): Scheduler {
  let s = schedulers.get(desiredRetention);
  if (!s) {
    s = buildScheduler(desiredRetention);
    schedulers.set(desiredRetention, s);
  }
  return s;
}

const DAY_MS = 86_400_000;
const STATES: CardState["state"][] = ["new", "learning", "review", "relearning"];

/** Whole-day interval, at least `CONFIG.minIntervalDays`, from the scheduler's fractional one. */
function dueFrom(card: SchedulerCard): string {
  const last = card.lastReviewAt ?? card.dueAt;
  const rawDays = (card.dueAt.getTime() - last.getTime()) / DAY_MS;
  const days = Math.max(CONFIG.minIntervalDays, Math.round(rawDays));
  return new Date(last.getTime() + days * DAY_MS).toISOString();
}

const byTime = (
  a: Pick<Attempt, "endedAt" | "createdAt">,
  b: Pick<Attempt, "endedAt" | "createdAt">,
) => a.endedAt.localeCompare(b.endedAt) || a.createdAt.localeCompare(b.createdAt);

/**
 * Rebuild a problem's card by replaying its attempts' ratings in order (spec 9.3), so card
 * state is never stored and can't drift from the history. Undefined with no attempts.
 */
export function replayCard(
  slug: string,
  attempts: readonly Pick<Attempt, "endedAt" | "createdAt" | "rating">[],
  scheduler: Scheduler = getScheduler(),
): CardState | undefined {
  if (attempts.length === 0) return undefined;
  const ordered = [...attempts].sort(byTime);
  let card = scheduler.newCard({ now: new Date(ordered[0]!.endedAt) });
  for (const a of ordered) {
    card = scheduler.review({ card, grade: a.rating, now: new Date(a.endedAt) }).card;
  }
  return {
    problemSlug: slug,
    due: dueFrom(card),
    stability: card.stability,
    stabilityFast: card.stabilityFast,
    difficulty: card.difficulty,
    reps: card.reps,
    lapses: card.lapses,
    state: STATES[card.state] ?? "review",
    ...(card.lastReviewAt ? { lastReview: card.lastReviewAt.toISOString() } : {}),
  };
}

/** Estimated probability of recalling the solution right now, 0 to 1. */
export function retrievability(
  card: CardState,
  now: Date,
  scheduler: Scheduler = getScheduler(),
): number {
  if (!card.lastReview) return 0;
  const elapsed = Math.max(0, (now.getTime() - Date.parse(card.lastReview)) / DAY_MS);
  const r = scheduler.model.forgettingCurve(
    { stability: card.stability, stabilityFast: card.stabilityFast, difficulty: card.difficulty },
    elapsed,
  );
  return Number.isFinite(r) ? Math.min(1, Math.max(0, r)) : 0;
}
