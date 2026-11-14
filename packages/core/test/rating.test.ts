import { describe, expect, it } from "vitest";
import {
  median,
  medianSolveSeconds,
  solveSeconds,
  suggestRating,
  type TimedHistoryItem,
} from "../src";

describe("suggestRating", () => {
  it("returns undefined without an outcome", () => {
    expect(suggestRating({})).toBeUndefined();
  });
  it("Again for not solved or heavy help", () => {
    expect(suggestRating({ outcome: "not_solved" })).toBe(1);
    expect(suggestRating({ outcome: "solved_with_help", helpLevel: "partial_code" })).toBe(1);
    expect(suggestRating({ outcome: "solved_with_help", helpLevel: "full_solution" })).toBe(1);
  });
  it("Hard for light help", () => {
    expect(suggestRating({ outcome: "solved_with_help", helpLevel: "hint" })).toBe(2);
    expect(suggestRating({ outcome: "solved_with_help", helpLevel: "approach" })).toBe(2);
  });
  it("Hard for independent but suboptimal or slow", () => {
    expect(suggestRating({ outcome: "solved_independently", optimality: "suboptimal" })).toBe(2);
    expect(
      suggestRating(
        { outcome: "solved_independently", optimality: "optimal" },
        { solveSeconds: 1200, medianSeconds: 600 },
      ),
    ).toBe(2);
  });
  it("Good for independent optimal", () => {
    expect(suggestRating({ outcome: "solved_independently", optimality: "optimal" })).toBe(3);
    expect(suggestRating({ outcome: "solved_independently", optimality: "unsure" })).toBe(3);
    // No speed data: never Easy
    expect(
      suggestRating(
        { outcome: "solved_independently", optimality: "optimal" },
        { solveSeconds: 60 },
      ),
    ).toBe(3);
  });
  it("Easy for independent optimal and fast", () => {
    expect(
      suggestRating(
        { outcome: "solved_independently", optimality: "optimal" },
        { solveSeconds: 240, medianSeconds: 600 },
      ),
    ).toBe(4);
  });
});

describe("median helpers", () => {
  it("computes medians", () => {
    expect(median([])).toBeUndefined();
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
  });
  it("needs enough samples of the same difficulty", () => {
    const h = (difficulty: "Easy" | "Medium", s: number): TimedHistoryItem => ({
      difficulty,
      attempt: { outcome: "solved_independently", activeSeconds: s },
    });
    expect(medianSolveSeconds([h("Easy", 60), h("Easy", 120)], "Easy")).toBeUndefined();
    expect(
      medianSolveSeconds([h("Easy", 60), h("Easy", 120), h("Easy", 300), h("Medium", 1)], "Easy"),
    ).toBe(120);
  });
  it("times a solve to its last checkpoint, not to when the clock stopped", () => {
    const at = "2026-01-01T00:00:00.000Z";
    expect(solveSeconds({ activeSeconds: 900 })).toBe(900);
    expect(
      solveSeconds({
        activeSeconds: 900,
        checkpoints: [
          { at, activeSeconds: 300 },
          { at, activeSeconds: 600 },
        ],
      }),
    ).toBe(600);
  });
});
