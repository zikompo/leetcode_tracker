import {
  effectivePatterns,
  patternTrend,
  type PatternMastery,
  type TrendPoint,
} from "@leettrack/core";
import { problemRows, type ProblemRow } from "./rows";
import { listSlugs, type Snapshot } from "./snapshot";
import { masteryFrom } from "./views";

export interface UnstartedProblem {
  slug: string;
  title: string;
  frontendId?: string;
  difficulty?: ProblemRow["difficulty"];
}

export interface PatternDetail {
  id: string;
  /** Undefined for a pattern with no attempts and no active-list problems. */
  mastery?: PatternMastery;
  /** Problems with attempts that count towards the pattern, most recent first. */
  attempted: ProblemRow[];
  /** Not-started problems in the active lists suggested for this pattern, in list order. */
  unstarted: UnstartedProblem[];
  trend: TrendPoint[];
}

/** Everything the pattern page shows (spec 7.1, Patterns: problem list and trend chart). */
export function patternDetail(snap: Snapshot, id: string): PatternDetail {
  const attempted = problemRows(snap)
    .filter((r) => r.attempts > 0 && r.patterns.includes(id))
    .sort((a, b) => (b.lastAttempted ?? "").localeCompare(a.lastAttempted ?? ""));
  const started = new Set([
    ...snap.bySlug.keys(),
    ...snap.problems.filter((p) => p.statusOverride).map((p) => p.slug),
  ]);
  const seen = new Set<string>();
  const unstarted: UnstartedProblem[] = [];
  for (const slug of snap.settings.activeLists.flatMap((l) => listSlugs(snap, l))) {
    if (seen.has(slug) || started.has(slug)) continue;
    seen.add(slug);
    if (!snap.patternsOf(slug).suggestedPatterns.includes(id)) continue;
    const info = snap.info(slug);
    unstarted.push({
      slug,
      title: info.title ?? slug,
      ...(info.frontendId ? { frontendId: info.frontendId } : {}),
      ...(info.difficulty ? { difficulty: info.difficulty } : {}),
    });
  }
  const attempts = [...snap.bySlug]
    .filter(([slug]) => effectivePatterns(snap.patternsOf(slug)).includes(id))
    .flatMap(([, list]) => list);
  const mastery = masteryFrom(snap).find((m) => m.pattern === id);
  return {
    id,
    ...(mastery ? { mastery } : {}),
    attempted,
    unstarted,
    trend: patternTrend(attempts, snap.now),
  };
}
