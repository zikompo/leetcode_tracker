import { CONFIG } from "./config";
import type { Attempt, CardState, Difficulty } from "./types";

export type MasteryLevel = "not_started" | "learning" | "developing" | "proficient" | "mastered";

export const MASTERY_LABELS: Record<MasteryLevel, string> = {
  not_started: "Not started",
  learning: "Learning",
  developing: "Developing",
  proficient: "Proficient",
  mastered: "Mastered",
};

/** One problem as the mastery model sees it. */
export interface MasteryProblem {
  slug: string;
  difficulty: Difficulty;
  /** User-confirmed pattern ids. */
  patterns: readonly string[];
  /** Seed / topic suggestions; used when the user tagged nothing. */
  suggestedPatterns: readonly string[];
  attempts: readonly Attempt[];
  card?: CardState;
}

export interface MasteryInput {
  problems: readonly MasteryProblem[];
  /** Every problem in the active lists with its patterns (confirmed ∪ suggested), for coverage. */
  listProblems: readonly { slug: string; patterns: readonly string[] }[];
  retrievabilityOf(card: CardState): number;
}

export interface PatternMastery {
  pattern: string;
  level: MasteryLevel;
  /** Combined score M_T, 0 to 1. */
  mastery: number;
  /** R_T: weighted retrievability × quality of the latest full attempt. */
  retention: number;
  /** C_T: smoothed cold-solve rate. */
  coldSolve: number;
  /** V_T: share of this pattern's active-list problems attempted. Undefined when none are listed. */
  coverage?: number;
  attempted: number;
  attemptedByDifficulty: Record<Difficulty, number>;
  coldAttempts: number;
  coldSolved: number;
  listTotal: number;
}

export interface MasteryInsights {
  /** Lowest mastery among patterns with attempts, weakest first. */
  weakest: PatternMastery[];
  /** High retention but low cold-solve: re-solvable but hard to spot fresh. */
  retentionColdGap: PatternMastery[];
}

/** Quality of an attempt for R_T (spec 6.1). */
export function attemptQuality(a: Pick<Attempt, "outcome" | "helpLevel" | "optimality">): number {
  const q = CONFIG.mastery.quality;
  if (a.outcome === "solved_independently") {
    return a.optimality === "optimal" ? q.independentOptimal : q.independentSuboptimal;
  }
  if (a.outcome === "solved_with_help") {
    return a.helpLevel === "hint" || a.helpLevel === "approach" ? q.lightHelp : q.heavyHelp;
  }
  return q.notSolved;
}

/** Patterns a problem counts towards: what the user confirmed, else what was suggested. */
export const effectivePatterns = (p: Pick<MasteryProblem, "patterns" | "suggestedPatterns">) =>
  p.patterns.length > 0 ? p.patterns : p.suggestedPatterns;

function levelFor(m: Omit<PatternMastery, "level" | "pattern">): MasteryLevel {
  const L = CONFIG.mastery.levels;
  if (m.attempted === 0) return "not_started";
  const { Medium, Hard } = m.attemptedByDifficulty;
  if (
    m.mastery >= L.mastered.minScore &&
    m.attempted >= L.mastered.minProblems &&
    (Hard >= 1 || Medium >= L.mastered.mediumsInsteadOfHard) &&
    m.coldSolve >= L.mastered.minColdSolve
  ) {
    return "mastered";
  }
  if (
    m.mastery >= L.proficient.minScore &&
    m.attempted >= L.proficient.minProblems &&
    Medium + Hard >= 1
  )
    return "proficient";
  if (m.mastery >= L.developing.minScore) return "developing";
  return "learning";
}

/** Per-pattern mastery (spec 6): R_T, C_T, V_T, the combined M_T, and a level. */
export function computeMastery(input: MasteryInput): PatternMastery[] {
  const C = CONFIG.mastery;
  const attemptedSlugs = new Set(
    input.problems.filter((p) => p.attempts.length).map((p) => p.slug),
  );
  const patterns = new Set<string>();
  for (const p of input.problems)
    if (p.attempts.length) effectivePatterns(p).forEach((t) => patterns.add(t));
  for (const p of input.listProblems) p.patterns.forEach((t) => patterns.add(t));

  return [...patterns].sort().map((pattern) => {
    const mine = input.problems.filter(
      (p) => p.attempts.length > 0 && effectivePatterns(p).includes(pattern),
    );

    let weighted = 0;
    let weights = 0;
    const byDifficulty: Record<Difficulty, number> = { Easy: 0, Medium: 0, Hard: 0 };
    let coldAttempts = 0;
    let coldSolved = 0;
    for (const p of mine) {
      byDifficulty[p.difficulty] += 1;
      const w = C.difficultyWeight[p.difficulty];
      const latestFull = [...p.attempts]
        .filter((a) => a.kind !== "quick")
        .sort((a, b) => a.endedAt.localeCompare(b.endedAt))
        .at(-1);
      const r = p.card ? input.retrievabilityOf(p.card) : 0;
      weighted += w * r * (latestFull ? attemptQuality(latestFull) : 0);
      weights += w;
      for (const a of p.attempts) {
        if (!a.isCold) continue;
        coldAttempts += 1;
        if (a.outcome === "solved_independently") coldSolved += 1;
      }
    }
    const retention = weights > 0 ? weighted / weights : 0;
    const coldSolve =
      (coldSolved + C.coldPriorStrength * C.coldPrior) / (coldAttempts + C.coldPriorStrength);

    const listed = input.listProblems.filter((p) => p.patterns.includes(pattern));
    const coverage =
      listed.length > 0
        ? listed.filter((p) => attemptedSlugs.has(p.slug)).length / listed.length
        : undefined;

    // Without list problems for this pattern, coverage can't be measured: reweight the rest.
    const w = C.weights;
    const mastery =
      coverage === undefined
        ? (w.retention * retention + w.coldSolve * coldSolve) / (w.retention + w.coldSolve)
        : w.retention * retention + w.coldSolve * coldSolve + w.coverage * coverage;

    const base = {
      mastery,
      retention,
      coldSolve,
      ...(coverage !== undefined ? { coverage } : {}),
      attempted: mine.length,
      attemptedByDifficulty: byDifficulty,
      coldAttempts,
      coldSolved,
      listTotal: listed.length,
    };
    return { pattern, level: levelFor(base), ...base };
  });
}

export function masteryInsights(all: readonly PatternMastery[]): MasteryInsights {
  const C = CONFIG.mastery;
  const started = all.filter((m) => m.attempted > 0);
  return {
    weakest: [...started].sort((a, b) => a.mastery - b.mastery).slice(0, C.weakestCount),
    retentionColdGap: started
      .filter((m) => m.retention >= C.gapMinRetention && m.retention - m.coldSolve >= C.gapMin)
      .sort((a, b) => b.retention - b.coldSolve - (a.retention - a.coldSolve)),
  };
}
