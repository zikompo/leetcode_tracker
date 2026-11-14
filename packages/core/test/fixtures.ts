import type { Attempt, Problem } from "../src";

let n = 0;
export function makeAttempt(over: Partial<Attempt> = {}): Attempt {
  n += 1;
  const t = new Date(Date.UTC(2026, 0, n)).toISOString();
  return {
    id: `a${n}`,
    problemSlug: "two-sum",
    startedAt: t,
    endedAt: t,
    activeSeconds: 600,
    isCold: false,
    kind: "full",
    outcome: "solved_independently",
    helpLevel: "none",
    viewedSolutionDetected: false,
    optimality: "optimal",
    suggestedRating: 3,
    rating: 3,
    submissions: [],
    createdAt: t,
    updatedAt: t,
    ...over,
  };
}

export function makeProblem(over: Partial<Problem> = {}): Problem {
  return {
    slug: "two-sum",
    frontendId: "1",
    title: "Two Sum",
    difficulty: "Easy",
    url: "https://leetcode.com/problems/two-sum/",
    leetcodeTopics: ["Array", "Hash Table"],
    patterns: [],
    suggestedPatterns: [],
    lists: [],
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...over,
  };
}
