import { NEETCODE_ROWS } from "./neetcode.data";

export type ListId = "blind75" | "neetcode150" | "neetcode250";

export interface SeedList {
  id: ListId;
  name: string;
}

export const LISTS: readonly SeedList[] = [
  { id: "blind75", name: "Blind 75" },
  { id: "neetcode150", name: "NeetCode 150" },
  { id: "neetcode250", name: "NeetCode 250" },
];

export interface SeedProblem {
  slug: string;
  /** LeetCode number, e.g. "217". */
  frontendId: string;
  title: string;
  difficulty: "Easy" | "Medium" | "Hard";
  /** NeetCode's roadmap category, e.g. "Sliding Window". */
  category: string;
  lists: ListId[];
  /** Taxonomy ids. Hidden from the user until they've logged an attempt (spec 4.4). */
  suggestedPatterns: string[];
  /** The problem's slug on neetcode.io, which often differs from LeetCode's (two-integer-sum). */
  neetcodeSlug: string;
}

/** First-guess pattern for each NeetCode category. */
const CATEGORY_PATTERNS: Record<string, string[]> = {
  "Arrays & Hashing": ["arrays-hashing"],
  "Two Pointers": ["two-pointers"],
  "Sliding Window": ["sliding-window-variable"],
  Stack: ["stack"],
  "Binary Search": ["binary-search-index"],
  "Linked List": ["linked-list"],
  Trees: ["tree-dfs"],
  "Heap / Priority Queue": ["heap-top-k"],
  Backtracking: ["backtracking"],
  Tries: ["trie"],
  Graphs: ["graph-dfs"],
  "Advanced Graphs": ["dijkstra"],
  "1-D Dynamic Programming": ["dp-1d"],
  "2-D Dynamic Programming": ["dp-2d"],
  Greedy: ["greedy"],
  Intervals: ["intervals"],
  "Math & Geometry": ["math-geometry"],
  "Bit Manipulation": ["bit-manipulation"],
};

/** Where the category is too coarse: the usual approach for that problem, most central first. */
const OVERRIDES: Record<string, string[]> = {
  // Arrays & hashing
  "design-hashset": ["design", "arrays-hashing"],
  "design-hashmap": ["design", "arrays-hashing"],
  "sort-colors": ["two-pointers"],
  "top-k-frequent-elements": ["heap-top-k", "arrays-hashing"],
  "range-sum-query-2d-immutable": ["prefix-sum"],
  "product-of-array-except-self": ["prefix-sum"],
  "best-time-to-buy-and-sell-stock-ii": ["greedy"],
  "subarray-sum-equals-k": ["prefix-sum", "arrays-hashing"],
  // Sliding window
  "contains-duplicate-ii": ["sliding-window-fixed", "arrays-hashing"],
  "permutation-in-string": ["sliding-window-fixed", "arrays-hashing"],
  "find-k-closest-elements": ["binary-search-index", "sliding-window-fixed"],
  "sliding-window-maximum": ["sliding-window-fixed", "monotonic-stack"],
  // Stack
  "implement-stack-using-queues": ["design", "stack"],
  "implement-queue-using-stacks": ["design", "stack"],
  "min-stack": ["design", "stack"],
  "maximum-frequency-stack": ["design", "stack"],
  "daily-temperatures": ["monotonic-stack"],
  "online-stock-span": ["monotonic-stack", "design"],
  "car-fleet": ["monotonic-stack"],
  "largest-rectangle-in-histogram": ["monotonic-stack"],
  // Binary search
  sqrtx: ["binary-search-answer"],
  "koko-eating-bananas": ["binary-search-answer"],
  "capacity-to-ship-packages-within-d-days": ["binary-search-answer"],
  "split-array-largest-sum": ["binary-search-answer"],
  "time-based-key-value-store": ["binary-search-index", "design"],
  // Linked list
  "linked-list-cycle": ["fast-slow-pointers", "linked-list"],
  "reorder-list": ["linked-list", "fast-slow-pointers"],
  "remove-nth-node-from-end-of-list": ["linked-list", "two-pointers"],
  "find-the-duplicate-number": ["fast-slow-pointers"],
  "design-circular-queue": ["design", "linked-list"],
  "lru-cache": ["design", "linked-list"],
  "lfu-cache": ["design", "linked-list"],
  "merge-k-sorted-lists": ["linked-list", "heap-top-k"],
  // Trees
  "lowest-common-ancestor-of-a-binary-search-tree": ["bst"],
  "insert-into-a-binary-search-tree": ["bst"],
  "delete-node-in-a-bst": ["bst"],
  "validate-binary-search-tree": ["bst", "tree-dfs"],
  "kth-smallest-element-in-a-bst": ["bst", "tree-dfs"],
  "binary-tree-level-order-traversal": ["tree-bfs"],
  "binary-tree-right-side-view": ["tree-bfs"],
  "serialize-and-deserialize-binary-tree": ["tree-dfs", "design"],
  // Heap
  "task-scheduler": ["heap-top-k", "greedy"],
  "design-twitter": ["heap-top-k", "design"],
  "reorganize-string": ["heap-top-k", "greedy"],
  "longest-happy-string": ["heap-top-k", "greedy"],
  "car-pooling": ["heap-top-k", "intervals"],
  "find-median-from-data-stream": ["two-heaps", "design"],
  ipo: ["two-heaps", "greedy"],
  // Tries
  "extra-characters-in-a-string": ["trie", "dp-1d"],
  "word-search-ii": ["trie", "backtracking"],
  // Graphs
  "verifying-an-alien-dictionary": ["arrays-hashing"],
  "find-the-town-judge": ["arrays-hashing"],
  "walls-and-gates": ["multi-source-bfs"],
  "rotting-oranges": ["multi-source-bfs"],
  "open-the-lock": ["graph-bfs"],
  "word-ladder": ["graph-bfs"],
  "course-schedule": ["topological-sort"],
  "course-schedule-ii": ["topological-sort"],
  "course-schedule-iv": ["topological-sort", "graph-dfs"],
  "graph-valid-tree": ["union-find", "graph-dfs"],
  "number-of-connected-components-in-an-undirected-graph": ["union-find", "graph-dfs"],
  "redundant-connection": ["union-find"],
  "accounts-merge": ["union-find"],
  "minimum-height-trees": ["topological-sort", "graph-bfs"],
  // Advanced graphs
  "reconstruct-itinerary": ["graph-dfs"],
  "min-cost-to-connect-all-points": ["mst"],
  "alien-dictionary": ["topological-sort"],
  "cheapest-flights-within-k-stops": ["bellman-ford"],
  "find-critical-and-pseudo-critical-edges-in-minimum-spanning-tree": ["mst", "union-find"],
  "build-a-matrix-with-conditions": ["topological-sort"],
  "greatest-common-divisor-traversal": ["union-find", "math-geometry"],
  // 1-D DP
  "longest-palindromic-substring": ["dp-1d", "two-pointers"],
  "palindromic-substrings": ["dp-1d", "two-pointers"],
  "coin-change": ["knapsack", "dp-1d"],
  "longest-increasing-subsequence": ["lis-dp"],
  "partition-equal-subset-sum": ["knapsack"],
  "perfect-squares": ["knapsack", "dp-1d"],
  // 2-D DP
  "last-stone-weight-ii": ["knapsack"],
  "coin-change-ii": ["knapsack"],
  "target-sum": ["knapsack"],
  "stone-game": ["interval-dp"],
  "longest-increasing-path-in-a-matrix": ["dp-2d", "graph-dfs"],
  "burst-balloons": ["interval-dp"],
  // Greedy
  "longest-turbulent-subarray": ["sliding-window-variable", "greedy"],
  "hand-of-straights": ["greedy", "arrays-hashing"],
  // Intervals
  "meeting-rooms-ii": ["intervals", "heap-top-k"],
  "meeting-rooms-iii": ["intervals", "heap-top-k"],
  "minimum-interval-to-include-each-query": ["intervals", "heap-top-k"],
  // Math & geometry
  "insert-greatest-common-divisors-in-linked-list": ["math-geometry", "linked-list"],
  "happy-number": ["math-geometry", "fast-slow-pointers"],
  "detect-squares": ["math-geometry", "arrays-hashing"],
};

const LIST_FLAGS: Record<string, ListId> = { B: "blind75", N: "neetcode150", F: "neetcode250" };

/** All seed problems in NeetCode's roadmap order. */
export const SEED_PROBLEMS: readonly SeedProblem[] = NEETCODE_ROWS.map(
  ([slug, frontendId, title, difficulty, category, flags, neetcodeSlug]) => ({
    slug,
    frontendId,
    title,
    difficulty,
    category,
    lists: [...flags].map((f) => LIST_FLAGS[f]!),
    suggestedPatterns: OVERRIDES[slug] ?? CATEGORY_PATTERNS[category] ?? [],
    neetcodeSlug: neetcodeSlug || slug,
  }),
);

export const SEED_BY_SLUG: ReadonlyMap<string, SeedProblem> = new Map(
  SEED_PROBLEMS.map((p) => [p.slug, p]),
);

const BY_NEETCODE_SLUG: ReadonlyMap<string, SeedProblem> = new Map(
  SEED_PROBLEMS.map((p) => [p.neetcodeSlug, p]),
);

/** The seed problem a neetcode.io slug stands for, if it's one of NeetCode's lists. */
export const seedForNeetcodeSlug = (neetcodeSlug: string): SeedProblem | undefined =>
  BY_NEETCODE_SLUG.get(neetcodeSlug);

/** A LeetCode problem's page on neetcode.io, when NeetCode has it in its lists. */
export function neetcodeUrl(leetcodeSlug: string): string | undefined {
  const seed = SEED_BY_SLUG.get(leetcodeSlug);
  return seed ? `https://neetcode.io/problems/${seed.neetcodeSlug}/question` : undefined;
}

/** A list's problems, in roadmap order. */
export function listProblems(id: string): SeedProblem[] {
  return SEED_PROBLEMS.filter((p) => p.lists.includes(id as ListId));
}
