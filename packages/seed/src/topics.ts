/**
 * LeetCode topic tags that point at one taxonomy pattern without ambiguity. Broad tags
 * ("Array", "Dynamic Programming", "Tree", "Graph") are left out: they'd suggest nothing useful.
 */
export const TOPIC_TO_PATTERN: Readonly<Record<string, string>> = {
  "Hash Table": "arrays-hashing",
  "Prefix Sum": "prefix-sum",
  "Two Pointers": "two-pointers",
  "Sliding Window": "sliding-window-variable",
  Stack: "stack",
  "Monotonic Stack": "monotonic-stack",
  "Monotonic Queue": "monotonic-stack",
  "Binary Search": "binary-search-index",
  "Linked List": "linked-list",
  "Binary Search Tree": "bst",
  Trie: "trie",
  "Heap (Priority Queue)": "heap-top-k",
  Backtracking: "backtracking",
  Greedy: "greedy",
  "Union Find": "union-find",
  "Topological Sort": "topological-sort",
  "Shortest Path": "dijkstra",
  "Minimum Spanning Tree": "mst",
  "Bit Manipulation": "bit-manipulation",
  Geometry: "math-geometry",
  Design: "design",
};

/** Suggested pattern ids from a problem's LeetCode topics, without duplicates. */
export function patternsFromTopics(topics: readonly string[]): string[] {
  return [...new Set(topics.flatMap((t) => TOPIC_TO_PATTERN[t] ?? []))];
}
