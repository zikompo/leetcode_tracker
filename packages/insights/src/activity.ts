import type { Attempt } from "@leettrack/core";

export interface ActivityDay {
  /** Local date, YYYY-MM-DD. */
  date: string;
  count: number;
}

export interface Activity {
  /** Oldest first, ending today; always whole weeks starting on Sunday, for a heatmap grid. */
  days: ActivityDay[];
  /** Consecutive days up to today (or yesterday, if nothing yet today) with an attempt. */
  streak: number;
  activeDays: number;
  total: number;
}

const pad = (n: number) => String(n).padStart(2, "0");
export const localDate = (d: Date) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Attempts per local day for the last `weeks` weeks, plus the current streak. */
export function activity(
  attempts: readonly Pick<Attempt, "endedAt">[],
  now: Date = new Date(),
  weeks = 26,
): Activity {
  const counts = new Map<string, number>();
  for (const a of attempts) {
    const key = localDate(new Date(a.endedAt));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const start = new Date(today);
  start.setDate(start.getDate() - (weeks - 1) * 7 - today.getDay());
  const days: ActivityDay[] = [];
  for (const d = new Date(start); d <= today; d.setDate(d.getDate() + 1)) {
    const date = localDate(d);
    days.push({ date, count: counts.get(date) ?? 0 });
  }

  let streak = 0;
  const cursor = new Date(today);
  if (!counts.has(localDate(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (counts.has(localDate(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }
  return {
    days,
    streak,
    activeDays: days.filter((d) => d.count > 0).length,
    total: days.reduce((n, d) => n + d.count, 0),
  };
}
