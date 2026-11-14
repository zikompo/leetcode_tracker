import { describe, expect, it } from "vitest";
import {
  buildAttempt,
  buildQuickAttempt,
  formatComplexity,
  formatDuration,
  suggestHelpLevel,
  validateDraft,
  type SessionObservation,
} from "../src";

const session: SessionObservation = {
  startedAt: "2026-01-01T00:00:00.000Z",
  activeSeconds: 754.4,
  submissions: [{ at: "2026-01-01T00:10:00.000Z", status: "Accepted", runtimeMs: 3 }],
  viewedSolutionDetected: false,
  language: "python3",
  code: "class Solution: ...",
};

describe("validateDraft", () => {
  it("requires outcome and rating", () => {
    expect(Object.keys(validateDraft({ patterns: [] })).sort()).toEqual(["outcome", "rating"]);
  });
  it("requires help level only when solved with help", () => {
    expect(
      validateDraft({
        patterns: [],
        outcome: "solved_with_help",
        optimality: "optimal",
        rating: 2,
      }),
    ).toHaveProperty("helpLevel");
    expect(validateDraft({ patterns: [], outcome: "not_solved", rating: 1 })).toEqual({});
  });
  it("requires optimality when solved", () => {
    expect(
      validateDraft({ patterns: [], outcome: "solved_independently", rating: 3 }),
    ).toHaveProperty("optimality");
  });
});

describe("buildAttempt", () => {
  it("builds a cold first attempt", () => {
    const a = buildAttempt({
      slug: "two-sum",
      draft: {
        patterns: [],
        outcome: "solved_independently",
        optimality: "optimal",
        rating: 3,
        notes: "  hash map  ",
      },
      session,
      suggestedRating: 3,
      priorAttemptCount: 0,
      now: new Date("2026-01-01T00:15:00.000Z"),
      id: "fixed",
    });
    expect(a).toMatchObject({
      id: "fixed",
      isCold: true,
      helpLevel: "none",
      activeSeconds: 754,
      notes: "hash map",
      code: "class Solution: ...",
      language: "python3",
      endedAt: "2026-01-01T00:15:00.000Z",
    });
    expect(a.submissions).toHaveLength(1);
    expect(a.secondsToApproach).toBeUndefined();
  });
  it("ends the attempt when the timer stopped, not when it was saved", () => {
    const a = buildAttempt({
      slug: "two-sum",
      draft: { patterns: [], outcome: "not_solved", rating: 1 },
      session: { ...session, stoppedAt: "2026-01-01T00:12:00.000Z" },
      suggestedRating: 1,
      priorAttemptCount: 0,
      now: new Date("2026-01-01T03:00:00.000Z"),
    });
    expect(a.endedAt).toBe("2026-01-01T00:12:00.000Z");
  });
  it("attaches complexity to each checkpoint; the last one is the achieved complexity", () => {
    const a = buildAttempt({
      slug: "two-sum",
      draft: {
        patterns: [],
        outcome: "solved_independently",
        optimality: "optimal",
        rating: 3,
        complexities: [
          { time: "O(n²)", space: "O(1)" },
          { time: "O(n)", space: " O(n) " },
        ],
      },
      session: {
        ...session,
        checkpoints: [
          { at: "2026-01-01T00:08:00.000Z", activeSeconds: 480 },
          { at: "2026-01-01T00:12:00.000Z", activeSeconds: 700 },
        ],
      },
      suggestedRating: 3,
      priorAttemptCount: 0,
    });
    expect(a.checkpoints).toEqual([
      { at: "2026-01-01T00:08:00.000Z", activeSeconds: 480, time: "O(n²)", space: "O(1)" },
      { at: "2026-01-01T00:12:00.000Z", activeSeconds: 700, time: "O(n)", space: "O(n)" },
    ]);
    expect(a.complexityAchieved).toBe("O(n) time, O(n) space");
    // Optimal means the achieved complexity is the optimal one.
    expect(a.complexityOptimal).toBe("O(n) time, O(n) space");
  });
  it("uses the single complexity entry when nothing was accepted, and optimal only if suboptimal", () => {
    const base = { slug: "x", session, suggestedRating: 2 as const, priorAttemptCount: 0 };
    const a = buildAttempt({
      ...base,
      draft: {
        patterns: [],
        outcome: "solved_with_help",
        helpLevel: "hint",
        optimality: "suboptimal",
        rating: 2,
        complexities: [{ time: "O(n²)" }],
        optimalComplexity: { time: "O(n)" },
      },
    });
    expect(a.checkpoints).toBeUndefined();
    expect(a.complexityAchieved).toBe("O(n²) time");
    expect(a.complexityOptimal).toBe("O(n) time");
    const unsure = buildAttempt({
      ...base,
      draft: {
        patterns: [],
        outcome: "solved_independently",
        optimality: "unsure",
        rating: 3,
        optimalComplexity: { time: "O(n)" },
      },
    });
    expect(unsure.complexityAchieved).toBeUndefined();
    expect(unsure.complexityOptimal).toBeUndefined();
  });
  it("is not cold when seen before or not the first attempt", () => {
    const base = { slug: "x", session, suggestedRating: 1 as const };
    const draft = { patterns: [], outcome: "not_solved" as const, rating: 1 as const };
    expect(
      buildAttempt({ ...base, draft: { ...draft, seenBefore: true }, priorAttemptCount: 0 }).isCold,
    ).toBe(false);
    expect(buildAttempt({ ...base, draft, priorAttemptCount: 2 }).isCold).toBe(false);
    expect(buildAttempt({ ...base, draft, priorAttemptCount: 0 }).optimality).toBeUndefined();
  });
  it("throws on an invalid draft", () => {
    expect(() =>
      buildAttempt({
        slug: "x",
        session,
        suggestedRating: 1,
        priorAttemptCount: 0,
        draft: { patterns: [] },
      }),
    ).toThrow();
  });
});

describe("misc", () => {
  it("suggests help level from viewed solution", () => {
    expect(suggestHelpLevel(true)).toBe("approach");
    expect(suggestHelpLevel(false)).toBeUndefined();
  });
  it("formats complexity", () => {
    expect(formatComplexity({ time: "O(n)", space: "O(1)" })).toBe("O(n) time, O(1) space");
    expect(formatComplexity({ space: "O(1)" })).toBe("O(1) space");
    expect(formatComplexity({ time: "  " })).toBeUndefined();
    expect(formatComplexity(undefined)).toBeUndefined();
  });
  it("formats durations", () => {
    expect(formatDuration(42)).toBe("42s");
    expect(formatDuration(754)).toBe("12m 34s");
    expect(formatDuration(3720)).toBe("1h 2m");
  });
});

describe("buildQuickAttempt", () => {
  it("records a quick review; Again means not recalled", () => {
    const good = buildQuickAttempt({
      slug: "two-sum",
      session,
      approach: "  hash map of value to index ",
      complexity: { time: "O(n)" },
      rating: 3,
      now: new Date("2026-01-02T00:00:00.000Z"),
    });
    expect(good).toMatchObject({
      kind: "quick",
      outcome: "solved_independently",
      isCold: false,
      notes: "hash map of value to index",
      complexityAchieved: "O(n) time",
      rating: 3,
      endedAt: "2026-01-02T00:00:00.000Z",
    });
    expect(buildQuickAttempt({ slug: "x", session, rating: 1 }).outcome).toBe("not_solved");
  });
});
