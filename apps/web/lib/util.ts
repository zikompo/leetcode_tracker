/** A problem slug from a LeetCode URL ("…/problems/two-sum/description/") or a bare slug. */
export function parseProblemRef(input: string): string | null {
  const s = input.trim();
  const fromUrl = /leetcode\.(?:com|cn)\/problems\/([a-z0-9-]+)/i.exec(s);
  const slug = (fromUrl ? fromUrl[1]! : s).toLowerCase();
  return /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) ? slug : null;
}

export const leetcodeUrl = (slug: string) => `https://leetcode.com/problems/${slug}/`;

export function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

const DAY_MS = 86_400_000;
const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();

/** "today", "tomorrow", "in 4 days", "3 days overdue". */
export function formatDue(iso: string, now: Date = new Date()): string {
  const days = Math.round((startOfDay(new Date(iso)) - startOfDay(now)) / DAY_MS);
  if (days < 0) return `${-days} day${days === -1 ? "" : "s"} overdue`;
  if (days === 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

export const pct = (x: number | undefined) => (x === undefined ? "–" : `${Math.round(x * 100)}%`);
