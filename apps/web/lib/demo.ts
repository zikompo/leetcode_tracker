import {
  DEFAULT_SETTINGS,
  dateKey,
  type Attempt,
  type CustomList,
  type HelpLevel,
  type Optimality,
  type Outcome,
  type Problem,
  type Rating,
} from "@leettrack/core";
import type { DataSet } from "@leettrack/insights";
import { SEED_PROBLEMS } from "@leettrack/seed";

/** Small deterministic PRNG so demo data (and tests against it) is stable. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const DAY = 86_400_000;

// Generic code, so diffs between attempts have something to show. Not tied to any problem.
const CODE = [
  `class Solution:
    def solve(self, nums):
        for i in range(len(nums)):
            for j in range(i + 1, len(nums)):
                if self.check(nums[i], nums[j]):
                    return [i, j]
        return []`,
  `class Solution:
    def solve(self, nums):
        seen = {}
        for i, x in enumerate(nums):
            if x in seen:
                return [seen[x], i]
            seen[self.key(x)] = i
        return []`,
  `class Solution:
    def solve(self, nums):
        nums.sort()
        lo, hi = 0, len(nums) - 1
        while lo < hi:
            total = nums[lo] + nums[hi]
            if total == 0:
                return [lo, hi]
            lo, hi = (lo + 1, hi) if total < 0 else (lo, hi - 1)
        return []`,
];

const NOTES = [
  "Hash map from value to index, one pass.",
  "Sort first, then two pointers from both ends.",
  "Write the brute force first, then cache repeated work.",
  "Draw the state transitions before coding.",
];
/** What gave the pattern away, by the problem's first suggested pattern. */
const CLUES: Record<string, string[]> = {
  "arrays-hashing": ["Asked for pairs: think complement lookup.", "Need to group by a key."],
  "two-pointers": ["Sorted input and a pair to find: two pointers from both ends."],
  "sliding-window-variable": ["Longest substring with a condition: grow and shrink a window."],
  stack: ["Matching brackets: last opened, first closed."],
  "monotonic-stack": ['"Next greater" for every element: a monotonic stack.'],
  "binary-search-index": ["Sorted and asked for O(log n)."],
  "binary-search-answer": ["Minimise the largest value: binary search on the answer."],
  "linked-list": ["Rewire pointers in place; a dummy head saves edge cases."],
  "tree-dfs": ["Answer for a node depends on its subtrees."],
  "tree-bfs": ["Level by level: a queue."],
  "heap-top-k": ["k largest or k closest: a heap of size k."],
  backtracking: ["All combinations or permutations: choose, explore, undo."],
  "graph-dfs": ["Count connected regions in a grid."],
  "graph-bfs": ["Shortest path in an unweighted grid."],
  "topological-sort": ["Prerequisites: an order of a DAG."],
  intervals: ["Overlapping ranges: sort by start."],
  greedy: ["A local best choice never hurts later."],
};
const DEFAULT_CLUES = ["Overlapping subproblems in the recursion."];
const STUCK = [
  "Off-by-one on the window bounds.",
  "Forgot to handle duplicates.",
  "Didn't see how to avoid the nested loop.",
];

/**
 * A realistic account's worth of data, relative to `now`: ~40 problems over five months,
 * mixed outcomes, a leech, notes and code that changes between attempts (spec 13).
 */
export function demoData(now: Date = new Date()): DataSet {
  const rand = mulberry32(42);
  const pick = <T>(xs: readonly T[]) => xs[Math.floor(rand() * xs.length)]!;
  const nc150 = SEED_PROBLEMS.filter((p) => p.lists.includes("neetcode150"));
  const chosen = nc150.filter((_, i) => i % 4 === 0).slice(0, 38);
  const problems: Problem[] = [];
  const attempts: Attempt[] = [];

  chosen.forEach((seed, idx) => {
    const leech = idx === 5;
    const count = leech ? 4 : 1 + Math.floor(rand() * 3);
    let t = now.getTime() - (20 + Math.floor(rand() * 130)) * DAY;
    for (let k = 0; k < count; k++) {
      const roll = rand();
      const outcome: Outcome =
        leech && k < 3
          ? "not_solved"
          : roll < 0.15 + 0.1 * (seed.difficulty === "Hard" ? 1 : 0) - 0.05 * k
            ? "not_solved"
            : roll < 0.4
              ? "solved_with_help"
              : "solved_independently";
      const helpLevel: HelpLevel =
        outcome === "solved_with_help"
          ? pick(["hint", "approach", "partial_code"] as const)
          : "none";
      const optimality: Optimality | undefined =
        outcome === "not_solved" ? undefined : rand() < 0.7 ? "optimal" : "suboptimal";
      const rating: Rating =
        outcome === "not_solved" || helpLevel === "partial_code"
          ? 1
          : outcome === "solved_with_help" || optimality === "suboptimal"
            ? 2
            : rand() < 0.8
              ? 3
              : 4;
      const ended = new Date(t + Math.floor(rand() * 8) * 3_600_000);
      const minutes = 8 + Math.floor(rand() * (seed.difficulty === "Hard" ? 60 : 35));
      const iso = ended.toISOString();
      const attempt: Attempt = {
        id: `demo-${seed.slug}-${k}`,
        problemSlug: seed.slug,
        startedAt: new Date(ended.getTime() - minutes * 60_000).toISOString(),
        endedAt: iso,
        activeSeconds: minutes * 60,
        isCold: k === 0,
        kind: "full",
        outcome,
        helpLevel,
        viewedSolutionDetected: helpLevel !== "none",
        suggestedRating: rating,
        rating,
        submissions: [{ at: iso, status: outcome === "not_solved" ? "Wrong Answer" : "Accepted" }],
        language: "python3",
        code: CODE[Math.min(k, CODE.length - 1)]!,
        createdAt: iso,
        updatedAt: iso,
      };
      if (optimality) attempt.optimality = optimality;
      if (outcome !== "not_solved")
        attempt.secondsToApproach = Math.round(minutes * 60 * (0.25 + rand() * 0.5));
      if (optimality)
        attempt.complexityAchieved =
          optimality === "optimal" ? "O(n) time, O(n) space" : "O(n²) time, O(1) space";
      if (rand() < 0.6) attempt.notes = pick(NOTES);
      if (outcome !== "solved_independently" && rand() < 0.8) attempt.stuckNote = pick(STUCK);
      if (leech) attempt.stuckNote = STUCK[k % STUCK.length]!;
      if (rand() < 0.5)
        attempt.patternClue = pick(CLUES[seed.suggestedPatterns[0] ?? ""] ?? DEFAULT_CLUES);
      attempts.push(attempt);
      t = ended.getTime() + (2 + Math.floor(rand() * 20)) * DAY;
      if (t > now.getTime() - DAY) break;
    }
    const updatedAt = attempts.at(-1)!.updatedAt;
    problems.push({
      slug: seed.slug,
      frontendId: seed.frontendId,
      title: seed.title,
      difficulty: seed.difficulty,
      url: `https://leetcode.com/problems/${seed.slug}/`,
      leetcodeTopics: [],
      patterns: seed.suggestedPatterns.slice(0, 1),
      suggestedPatterns: seed.suggestedPatterns,
      lists: seed.lists,
      // One review moved by hand, so the review queue shows what that looks like.
      ...(idx === 2
        ? {
            dueOverride: {
              due: new Date(now.getFullYear(), now.getMonth(), now.getDate() + 3).toISOString(),
              at: now.toISOString(),
            },
          }
        : {}),
      updatedAt,
    });
  });

  const lists: CustomList[] = [
    {
      id: "demo-list-graphs",
      name: "Graphs to revisit",
      slugs: ["number-of-islands", "course-schedule", "rotting-oranges", "word-ladder"],
      updatedAt: now.toISOString(),
    },
  ];
  return {
    problems,
    attempts,
    settings: {
      ...DEFAULT_SETTINGS,
      targetDates: [
        {
          id: "demo-onsite",
          label: "Onsite interview",
          date: dateKey(new Date(now.getTime() + 24 * DAY)),
          listIds: ["blind75"],
          createdAt: new Date(now.getTime() - 10 * DAY).toISOString(),
        },
        {
          id: "demo-phone",
          label: "Phone screen",
          date: dateKey(new Date(now.getTime() + 6 * DAY)),
          listIds: ["demo-list-graphs"],
          createdAt: new Date(now.getTime() - 3 * DAY).toISOString(),
        },
      ],
      updatedAt: now.toISOString(),
    },
    customLists: lists,
    mocks: [
      {
        id: "demo-mock-1",
        date: dateKey(new Date(now.getTime() - 26 * DAY)),
        problem: "longest-substring-with-at-most-k-distinct-characters",
        outcome: "mixed",
        notes: "Got there with two pointers, but took the full 45 minutes. Revise sliding window.",
        updatedAt: now.toISOString(),
      },
      {
        id: "demo-mock-2",
        date: dateKey(new Date(now.getTime() - 12 * DAY)),
        problem: "binary-tree-preorder-traversal",
        outcome: "passed",
        notes:
          "Solved; the follow-up wanted O(1) space with parent pointers. Only saw it at the end.",
        updatedAt: now.toISOString(),
      },
      {
        id: "demo-mock-3",
        date: dateKey(new Date(now.getTime() - 4 * DAY)),
        problem: "Minimum of V-shaped arrays",
        outcome: "struggled",
        notes:
          "First part fine; missed that binary search finds the minimum. Second part unfinished.",
        updatedAt: now.toISOString(),
      },
    ],
  };
}
