import { addDays, dateKey, daysUntil, fromDateKey, startOfDay } from "./deadline";

/**
 * The day-by-day plan and pace toward an interview date (spec 5.5). Pure: the caller decides
 * which problems remain and how many reviews fall on each day.
 */

/**
 * Keep each pattern's problems together, in the order the patterns first appear and the list's
 * own order within a pattern, so a plan works through one pattern at a time.
 */
export function groupByPattern<T extends { patterns: readonly string[] }>(
  items: readonly T[],
): T[] {
  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = item.patterns[0] ?? "";
    groups.set(key, [...(groups.get(key) ?? []), item]);
  }
  return [...groups.values()].flat();
}

export interface PlanDay<T> {
  /** YYYY-MM-DD */
  date: string;
  /** "learn": new problems; "review": the last days, reviews only; "target": the day itself. */
  kind: "learn" | "review" | "target";
  problems: T[];
  /** Reviews already scheduled for that day. */
  reviews: number;
  /** A "review" day because another interview is this close. */
  quietFor?: string;
}

export interface Plan<T> {
  days: PlanDay<T>[];
  /** Days left that can take new problems, today included. */
  learnDays: number;
  /** New problems a day it takes to finish in time (0 once nothing remains). */
  neededPerDay: number;
  /** Problems that don't fit before the target at the current daily limit. */
  unplanned: number;
  /** The last day with new problems, when everything fits. */
  finishesOn?: string;
}

/**
 * Lay the remaining problems over the days before `target` at the daily new-problem limit (what
 * the queue will actually offer), leaving the last `noNewDays` for reviews only.
 */
export function buildPlan<T>(input: {
  now: Date;
  target: string;
  /** In study order, e.g. grouped by pattern. */
  remaining: readonly T[];
  dailyNewLimit: number;
  noNewDays: number;
  /** New problems already started today: today has that much less room. */
  newDoneToday: number;
  reviewsOn?(date: string): number;
  /** New problems other plans already put on that day (they share the daily limit). */
  takenOn?(date: string): number;
  /** Another interview that makes the day reviews-only, by name. */
  quietOn?(date: string): string | undefined;
}): Plan<T> {
  const left = daysUntil(input.target, input.now);
  const today = startOfDay(input.now);
  const days: PlanDay<T>[] = [];
  let next = 0;
  let learnDays = 0;
  for (let i = 0; i <= Math.max(-1, left); i++) {
    const date = dateKey(addDays(today, i));
    const toGo = left - i;
    const quietFor = toGo > input.noNewDays ? input.quietOn?.(date) : undefined;
    const kind = toGo === 0 ? "target" : toGo <= input.noNewDays || quietFor ? "review" : "learn";
    let problems: T[] = [];
    if (kind === "learn") {
      learnDays += 1;
      const room = Math.max(
        0,
        input.dailyNewLimit - (i === 0 ? input.newDoneToday : 0) - (input.takenOn?.(date) ?? 0),
      );
      problems = input.remaining.slice(next, next + room);
      next += problems.length;
    }
    days.push({
      date,
      kind,
      problems,
      reviews: input.reviewsOn?.(date) ?? 0,
      ...(quietFor ? { quietFor } : {}),
    });
  }
  const remaining = input.remaining.length;
  const unplanned = remaining - next;
  const last = [...days].reverse().find((d) => d.problems.length > 0);
  return {
    days,
    learnDays,
    neededPerDay:
      remaining === 0 ? 0 : learnDays > 0 ? Math.ceil(remaining / learnDays) : remaining,
    unplanned,
    ...(unplanned === 0 && last ? { finishesOn: last.date } : {}),
  };
}

export interface PacePoint {
  date: string;
  /** Problems started by the end of the day; absent for days still to come. */
  actual?: number;
  /** Where a steady pace would be by the end of the day. */
  needed: number;
}

export interface Pace {
  points: PacePoint[];
  total: number;
  done: number;
  /** Problems ahead of (positive) or behind (negative) a steady pace; 0 means on pace. */
  ahead: number;
}

/**
 * Started-so-far against a straight line from where things stood when the target was set to
 * the whole list by the last day for new problems. Today counts as on pace until it's over:
 * you're behind only if short of where yesterday should have ended, ahead only once past today's.
 */
export function paceOf(input: {
  now: Date;
  /** When the target was set. */
  start: Date;
  target: string;
  noNewDays: number;
  /** When each problem in the target's lists was first started; null if not yet. */
  startedAt: readonly (string | null)[];
}): Pace {
  const today = startOfDay(input.now);
  const targetDay = fromDateKey(input.target);
  let first = startOfDay(input.start);
  if (first > today) first = today;
  if (first > targetDay) first = targetDay;
  const lastLearn = addDays(targetDay, -input.noNewDays - 1);
  const total = input.startedAt.length;
  const times = input.startedAt.flatMap((s) => (s ? [new Date(s).getTime()] : []));
  const doneBy = (end: Date) => times.filter((t) => t < end.getTime()).length;
  const base = doneBy(first);
  const span = Math.round((lastLearn.getTime() - first.getTime()) / 86_400_000) + 1;
  const neededBy = (i: number) =>
    span <= 0 ? total : base + (total - base) * Math.min(1, Math.max(0, (i + 1) / span));

  const points: PacePoint[] = [];
  for (let d = first, i = 0; d <= targetDay; d = addDays(d, 1), i++) {
    const end = addDays(d, 1);
    points.push({
      date: dateKey(d),
      ...(d <= today ? { actual: doneBy(end) } : {}),
      needed: Math.round(neededBy(i) * 10) / 10,
    });
  }
  const done = times.length;
  const todayIndex = Math.round((today.getTime() - first.getTime()) / 86_400_000);
  const neededYesterday = todayIndex > 0 ? neededBy(todayIndex - 1) : base;
  const neededToday = neededBy(todayIndex);
  const ahead =
    done < Math.floor(neededYesterday)
      ? done - Math.floor(neededYesterday)
      : done > Math.ceil(neededToday)
        ? done - Math.ceil(neededToday)
        : 0;
  return { points, total, done, ahead };
}
