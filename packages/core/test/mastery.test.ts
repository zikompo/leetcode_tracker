import { describe, expect, it } from "vitest";
import {
  attemptQuality,
  computeMastery,
  patternTrend,
  masteryInsights,
  resolvePatternIds,
  type CardState,
  type MasteryProblem,
} from "../src";
import { makeAttempt } from "./fixtures";

const card = (slug: string): CardState => ({
  problemSlug: slug,
  due: "2026-02-01T00:00:00.000Z",
  stability: 10,
  stabilityFast: 1,
  difficulty: 5,
  reps: 1,
  lapses: 0,
  state: "review",
  lastReview: "2026-01-01T00:00:00.000Z",
});
const problem = (
  slug: string,
  difficulty: MasteryProblem["difficulty"],
  attempts: MasteryProblem["attempts"],
  patterns = ["p"],
): MasteryProblem => ({
  slug,
  difficulty,
  patterns,
  suggestedPatterns: [],
  attempts,
  ...(attempts.length ? { card: card(slug) } : {}),
});
const solvedCold = (slug: string) =>
  makeAttempt({
    problemSlug: slug,
    isCold: true,
    outcome: "solved_independently",
    optimality: "optimal",
  });

describe("computeMastery", () => {
  it("matches a hand-computed example (spec 6)", () => {
    const [m] = computeMastery({
      problems: [
        problem("a", "Easy", [solvedCold("a")]),
        problem("b", "Medium", [
          makeAttempt({
            problemSlug: "b",
            isCold: true,
            outcome: "solved_with_help",
            helpLevel: "approach",
          }),
        ]),
      ],
      listProblems: ["a", "b", "c", "d"].map((slug) => ({ slug, patterns: ["p"] })),
      retrievabilityOf: (c) => (c.problemSlug === "a" ? 0.9 : 0.8),
    });
    // R = (1·0.9·1 + 2·0.8·0.5) / 3; C = (1 + 2·0.5) / (2 + 2); V = 2/4
    expect(m!.retention).toBeCloseTo(1.7 / 3);
    expect(m!.coldSolve).toBeCloseTo(0.5);
    expect(m!.coverage).toBeCloseTo(0.5);
    expect(m!.mastery).toBeCloseTo(0.5 * (1.7 / 3) + 0.3 * 0.5 + 0.2 * 0.5);
    expect(m!.level).toBe("developing");
  });

  it("needs harder problems and fresh solves for the top levels", () => {
    const fiveMediums = ["a", "b", "c", "d", "e"].map((s) => problem(s, "Medium", [solvedCold(s)]));
    const list = fiveMediums.map((p) => ({ slug: p.slug, patterns: ["p"] }));
    const [top] = computeMastery({
      problems: fiveMediums,
      listProblems: list,
      retrievabilityOf: () => 1,
    });
    expect(top!.level).toBe("mastered");

    const threeEasies = ["a", "b", "c"].map((s) => problem(s, "Easy", [solvedCold(s)]));
    const [easy] = computeMastery({
      problems: threeEasies,
      listProblems: threeEasies.map((p) => ({ slug: p.slug, patterns: ["p"] })),
      retrievabilityOf: () => 1,
    });
    expect(easy!.mastery).toBeGreaterThan(0.6);
    expect(easy!.level).toBe("developing"); // no Medium yet
  });

  it("covers patterns only seen in lists, and reweights when nothing is listed", () => {
    const ms = computeMastery({
      problems: [problem("a", "Easy", [solvedCold("a")], ["own"])],
      listProblems: [{ slug: "z", patterns: ["listed"] }],
      retrievabilityOf: () => 1,
    });
    const listed = ms.find((m) => m.pattern === "listed")!;
    expect(listed).toMatchObject({ level: "not_started", attempted: 0, coverage: 0 });
    const own = ms.find((m) => m.pattern === "own")!;
    expect(own.coverage).toBeUndefined();
    expect(own.mastery).toBeCloseTo((0.5 * 1 + 0.3 * own.coldSolve) / 0.8);
  });

  it("uses suggested patterns when the user tagged none, and ignores quick reviews for quality", () => {
    const p: MasteryProblem = {
      ...problem("a", "Easy", [
        solvedCold("a"),
        makeAttempt({
          problemSlug: "a",
          kind: "quick",
          outcome: "not_solved",
          endedAt: "2027-01-01T00:00:00.000Z",
        }),
      ]),
      patterns: [],
      suggestedPatterns: ["s"],
    };
    const [m] = computeMastery({ problems: [p], listProblems: [], retrievabilityOf: () => 1 });
    expect(m!.pattern).toBe("s");
    expect(m!.retention).toBe(1);
  });
});

describe("attemptQuality and insights", () => {
  it("grades attempts", () => {
    expect(
      attemptQuality({
        outcome: "solved_independently",
        helpLevel: "none",
        optimality: "suboptimal",
      }),
    ).toBe(0.75);
    expect(attemptQuality({ outcome: "solved_with_help", helpLevel: "full_solution" })).toBe(0.25);
    expect(attemptQuality({ outcome: "not_solved", helpLevel: "none" })).toBe(0);
  });
  it("flags patterns you can re-solve but not spot fresh", () => {
    const base = {
      level: "developing" as const,
      attempted: 2,
      attemptedByDifficulty: { Easy: 2, Medium: 0, Hard: 0 },
      coldAttempts: 2,
      coldSolved: 0,
      listTotal: 0,
    };
    const ins = masteryInsights([
      { ...base, pattern: "gap", mastery: 0.5, retention: 0.9, coldSolve: 0.3 },
      { ...base, pattern: "fine", mastery: 0.7, retention: 0.8, coldSolve: 0.7 },
    ]);
    expect(ins.retentionColdGap.map((m) => m.pattern)).toEqual(["gap"]);
    expect(ins.weakest[0]!.pattern).toBe("gap");
  });
  it("resolves merged patterns", () => {
    expect(resolvePatternIds(["a", "b", "c"], { a: "b", c: "d", d: "e" })).toEqual(["b", "e"]);
  });
});

describe("patternTrend", () => {
  const NOW = new Date(2026, 10, 15, 12);
  const at = (m: number, d: number) => new Date(2026, m, d, 12).toISOString();

  it("gives six months of cumulative cold-solve and monthly median time-to-approach", () => {
    const points = patternTrend(
      [
        makeAttempt({
          endedAt: at(7, 3),
          isCold: true,
          outcome: "not_solved",
          secondsToApproach: 900,
        }),
        makeAttempt({
          endedAt: at(9, 2),
          isCold: true,
          outcome: "solved_independently",
          secondsToApproach: 300,
        }),
        makeAttempt({
          endedAt: at(9, 20),
          isCold: false,
          outcome: "solved_independently",
          secondsToApproach: 100,
        }),
        makeAttempt({ endedAt: at(9, 25), isCold: true, outcome: "solved_independently" }),
      ],
      NOW,
    );
    expect(points.map((p) => p.month)).toEqual([
      "2026-06",
      "2026-07",
      "2026-08",
      "2026-09",
      "2026-10",
      "2026-11",
    ]);
    expect(points[0]).toEqual({ month: "2026-06", attempts: 0 });
    // August: one cold miss, smoothed with the prior (0 + 2×0.5) / (1 + 2).
    expect(points[2]!.coldSolve).toBeCloseTo(1 / 3);
    expect(points[2]!.medianApproachSeconds).toBe(900);
    // October: three cold attempts so far, two solved; median of 300 and 100.
    expect(points[4]!.coldSolve).toBeCloseTo(3 / 5);
    expect(points[4]!.medianApproachSeconds).toBe(200);
    expect(points[4]!.attempts).toBe(3);
    expect(points[5]).toMatchObject({ attempts: 0, coldSolve: points[4]!.coldSolve });
  });
});
