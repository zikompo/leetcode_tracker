/** Tunable heuristics. Keep every magic number here so it can be adjusted in one place. */
export const CONFIG = {
  /** Scheduler stability (days) above which a fully-solved optimal problem counts as mastered. */
  masteredStabilityDays: 30,
  /** Minimum prior timed independent solves (same difficulty) before speed influences the rating. */
  minSamplesForSpeed: 3,
  /** Time-to-approach at or below this fraction of the median counts as "fast". */
  fastRatio: 0.5,
  /** Default scheduler target retention. */
  desiredRetention: 0.9,
  /** Shortest gap between reviews, in days: a failed problem comes back tomorrow. */
  minIntervalDays: 1,
  /** Quick reviews (spec 5.4) are offered once card stability reaches this many days. */
  quickReviewStabilityDays: 21,
  /** Rated Again this many times makes a problem a leech (spec 5.6). */
  leechAgainCount: 3,
  /** Interleaving: at most this many queue items in a row share a pattern (spec 5.3). */
  maxSamePatternRun: 2,
  /** Pattern mastery (spec 6). Heuristics: tune here. */
  mastery: {
    weights: { retention: 0.5, coldSolve: 0.3, coverage: 0.2 },
    difficultyWeight: { Easy: 1, Medium: 2, Hard: 3 },
    quality: {
      independentOptimal: 1,
      independentSuboptimal: 0.75,
      lightHelp: 0.5,
      heavyHelp: 0.25,
      notSolved: 0,
    },
    coldPrior: 0.5,
    coldPriorStrength: 2,
    levels: {
      developing: { minScore: 0.4 },
      proficient: { minScore: 0.6, minProblems: 3 },
      mastered: { minScore: 0.8, minProblems: 5, mediumsInsteadOfHard: 4, minColdSolve: 0.6 },
    },
    weakestCount: 3,
    /** "Re-solvable but hard to spot fresh": retention at least this, and this far above cold-solve. */
    gapMinRetention: 0.6,
    gapMin: 0.3,
  },
} as const;
