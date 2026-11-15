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

/** "just now", "5 min ago", "3 h ago", "2 days ago". */
export function formatAgo(iso: string, now: Date = new Date()): string {
  const s = Math.max(0, (now.getTime() - Date.parse(iso)) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)} h ago`;
  const d = Math.floor(s / 86_400);
  return `${d} day${d === 1 ? "" : "s"} ago`;
}
