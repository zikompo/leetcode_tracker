const DAY_MS = 86_400_000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** Whole local days from `now` until `iso` (negative when overdue). */
export function daysUntil(iso: string, now: Date = new Date()): number {
  return Math.round((startOfDay(new Date(iso)) - startOfDay(now)) / DAY_MS);
}

/** "today", "tomorrow", "Tue 18 Nov (in 4 days)", "3 days overdue". */
export function formatDue(iso: string, now: Date = new Date()): string {
  const days = daysUntil(iso, now);
  if (days < 0) return `${-days} day${days === -1 ? "" : "s"} overdue`;
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  const date = new Date(iso).toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
  });
  return `${date} (in ${days} days)`;
}
