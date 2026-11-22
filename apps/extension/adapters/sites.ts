import {
  createSubmissionDetector,
  fetchProblemMetadata,
  isSolutionTab,
  parseProblemUrl,
  type ProblemMetadata,
  type SubmissionResult,
  type SubmissionStarted,
} from "./leetcode";
import {
  createNeetcodeDetector,
  fetchNeetcodeMetadata,
  isNeetcodeSolutionTab,
  leettrackSlugFor,
  parseNeetcodeUrl,
} from "./neetcode";

/** The sites whose problem pages the log panel runs on. */
export type SiteId = "leetcode" | "neetcode";

/** A problem page, in terms the panel understands whichever site it's on. */
export interface PageLocation {
  site: SiteId;
  /** The slug LeetTrack keys the problem by: LeetCode's. */
  slug: string;
  /** The site's own slug for the problem (the same as `slug` on LeetCode). */
  siteSlug: string;
  /** The site's tab, e.g. "description" or "solution". */
  tab: string;
  /** Whether this tab shows the solution, which makes the attempt one "with help". */
  revealsSolution: boolean;
}

export interface Site {
  id: SiteId;
  name: string;
  parseLocation(href: string): PageLocation | null;
  fetchMetadata(loc: PageLocation): Promise<ProblemMetadata | null>;
  createDetector(
    win: Window,
    cb: { onStarted(e: SubmissionStarted): void; onResult(e: SubmissionResult): void },
  ): () => void;
  /** CSS that hides the page's topic tags while an attempt runs, if the user asks. */
  hideTopicsCss: string;
}

export const LEETCODE: Site = {
  id: "leetcode",
  name: "LeetCode",
  parseLocation(href) {
    const loc = parseProblemUrl(href);
    return loc
      ? {
          site: "leetcode",
          slug: loc.slug,
          siteSlug: loc.slug,
          tab: loc.tab,
          revealsSolution: isSolutionTab(loc.tab),
        }
      : null;
  },
  fetchMetadata: (loc) => fetchProblemMetadata(loc.slug),
  createDetector: (win, cb) => createSubmissionDetector(win, cb),
  // Each topic is a link to /tag/<slug>/ in the "Topics" section.
  hideTopicsCss: 'a[href^="/tag/"] { display: none !important; }',
};

export const NEETCODE: Site = {
  id: "neetcode",
  name: "NeetCode",
  parseLocation(href) {
    const loc = parseNeetcodeUrl(href);
    return loc
      ? {
          site: "neetcode",
          slug: leettrackSlugFor(loc.neetcodeSlug),
          siteSlug: loc.neetcodeSlug,
          tab: loc.tab,
          revealsSolution: isNeetcodeSolutionTab(loc.tab),
        }
      : null;
  },
  fetchMetadata: (loc) => fetchNeetcodeMetadata(loc.siteSlug),
  createDetector: (win, cb) => createNeetcodeDetector(win, cb),
  // Topics are links to /practice/problem-list/<topic> inside the "Topics" accordion.
  hideTopicsCss: 'a[href^="/practice/problem-list/"] { display: none !important; }',
};

/** The problem page at `href` on any supported site, or null. */
export const parsePageLocation = (href: string): PageLocation | null =>
  LEETCODE.parseLocation(href) ?? NEETCODE.parseLocation(href);
