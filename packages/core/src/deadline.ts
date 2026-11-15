import type { CardState, TargetDate } from "./types";

/** Interview date mode (spec 5.5): extra reviews before a target, and no new problems late on. */

const DAY_MS = 86_400_000;

/** Local midnight of a YYYY-MM-DD date. */
export function fromDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y!, m! - 1, d!);
}

/** The local calendar date of `d`, as YYYY-MM-DD. */
export function dateKey(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d: Date, n: number) =>
  new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

/** Whole local days from today to `key`: 0 on the day itself, negative once it has passed. */
export function daysUntil(key: string, now: Date): number {
  return Math.round((fromDateKey(key).getTime() - startOfDay(now).getTime()) / DAY_MS);
}

/** Targets from today on, soonest first. */
export function upcomingTargets(
  targets: readonly TargetDate[] | undefined,
  now: Date,
): TargetDate[] {
  return (targets ?? [])
    .filter((t) => daysUntil(t.date, now) >= 0)
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** The target that rules out new problems today, if any: one `noNewDays` or fewer days away. */
export function noNewProblemsFor(
  targets: readonly TargetDate[] | undefined,
  now: Date,
  noNewDays: number,
): TargetDate | undefined {
  if (noNewDays <= 0) return undefined;
  return upcomingTargets(targets, now).find((t) => daysUntil(t.date, now) <= noNewDays);
}

export interface DeadlineReview {
  /** When the extra review is due: `bufferDays` before the target, or today if that's past. */
  due: string;
  target: TargetDate;
}

/**
 * An extra review before an interview (spec 5.5): when a card's next review falls on or after
 * the target date and the chance of recalling it on the day is below `minRecall`,
 * bring it forward to `bufferDays` before. Undefined when the normal schedule already covers it,
 * or the problem was reviewed inside that window.
 */
export function deadlineReview(
  card: Pick<CardState, "due" | "lastReview">,
  targets: readonly TargetDate[] | undefined,
  now: Date,
  opts: {
    bufferDays: number;
    /** Recall wanted on the day (the interview-day bar, not the everyday one). */
    minRecall: number;
    retrievabilityAt(at: Date): number;
  },
): DeadlineReview | undefined {
  const today = startOfDay(now);
  for (const target of upcomingTargets(targets, now)) {
    const day = fromDateKey(target.date);
    if (new Date(card.due) < day) continue; // reviewed before the interview anyway
    if (opts.retrievabilityAt(day) >= opts.minRecall) continue;
    const window = addDays(day, -opts.bufferDays);
    const due = window < today ? today : window;
    if (card.lastReview && new Date(card.lastReview) >= window) continue;
    if (due >= new Date(card.due)) continue;
    return { due: due.toISOString(), target };
  }
  return undefined;
}
