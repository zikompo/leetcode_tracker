export type ProblemTab =
  "description" | "editorial" | "solutions" | "submissions" | "discussion" | "other";

export interface ProblemLocation {
  slug: string;
  tab: ProblemTab;
}

const KNOWN_TABS = new Set<ProblemTab>([
  "description",
  "editorial",
  "solutions",
  "submissions",
  "discussion",
]);
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** `https://leetcode.com/problems/{slug}/{tab?}/...` → slug + tab, else null. */
export function parseProblemUrl(href: string): ProblemLocation | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.hostname !== "leetcode.com" && url.hostname !== "www.leetcode.com") return null;
  const [first, slug, tab] = url.pathname.split("/").filter(Boolean);
  if (first !== "problems" || !slug || !SLUG_RE.test(slug)) return null;
  if (!tab) return { slug, tab: "description" };
  return { slug, tab: KNOWN_TABS.has(tab as ProblemTab) ? (tab as ProblemTab) : "other" };
}

/** Tabs that reveal the approach; visiting one marks the attempt as "viewed solution". */
export const isSolutionTab = (tab: ProblemTab) => tab === "editorial" || tab === "solutions";

export const problemUrl = (slug: string) => `https://leetcode.com/problems/${slug}/`;

export const LEETCODE_MATCHES = ["https://leetcode.com/*"];
