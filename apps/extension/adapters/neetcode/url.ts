/** A problem page's tabs on neetcode.io: /problems/{slug}/{tab}. */
export type NeetcodeTab = "question" | "solution" | "history" | "discuss" | "notes" | "other";

export interface NeetcodeLocation {
  /** NeetCode's slug, which can differ from LeetCode's (two-integer-sum for two-sum). */
  neetcodeSlug: string;
  tab: NeetcodeTab;
}

const KNOWN_TABS = new Set<NeetcodeTab>(["question", "solution", "history", "discuss", "notes"]);
const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** `https://neetcode.io/problems/{slug}/{tab?}` → slug + tab, else null. */
export function parseNeetcodeUrl(href: string): NeetcodeLocation | null {
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return null;
  }
  if (url.hostname !== "neetcode.io" && url.hostname !== "www.neetcode.io") return null;
  const [first, slug, tab] = url.pathname.split("/").filter(Boolean);
  if (first !== "problems" || !slug || !SLUG_RE.test(slug)) return null;
  if (!tab) return { neetcodeSlug: slug, tab: "question" };
  return {
    neetcodeSlug: slug,
    tab: KNOWN_TABS.has(tab as NeetcodeTab) ? (tab as NeetcodeTab) : "other",
  };
}

/** The Solution tab holds the written solution and the video: opening it counts as help. */
export const isNeetcodeSolutionTab = (tab: NeetcodeTab) => tab === "solution";

export const neetcodeProblemUrl = (neetcodeSlug: string) =>
  `https://neetcode.io/problems/${neetcodeSlug}/question`;

/** Where the NeetCode scripts run. Access is optional: the user turns it on in Settings. */
export const NEETCODE_MATCHES = ["https://neetcode.io/*"];
