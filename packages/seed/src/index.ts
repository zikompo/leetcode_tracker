export interface Pattern {
  id: string;
  name: string;
}

/** Initial pattern taxonomy (spec 12.2). User edits (add/rename/merge) arrive in M3. */
export const PATTERNS: readonly Pattern[] = [
  ["arrays-hashing", "Arrays & hashing"],
  ["prefix-sum", "Prefix sum"],
  ["two-pointers", "Two pointers"],
  ["sliding-window-fixed", "Sliding window (fixed)"],
  ["sliding-window-variable", "Sliding window (variable)"],
  ["stack", "Stack"],
  ["monotonic-stack", "Monotonic stack"],
  ["binary-search-index", "Binary search (on index)"],
  ["binary-search-answer", "Binary search (on answer)"],
  ["linked-list", "Linked list"],
  ["fast-slow-pointers", "Fast & slow pointers"],
  ["tree-dfs", "Tree DFS"],
  ["tree-bfs", "Tree BFS"],
  ["bst", "BST"],
  ["trie", "Trie"],
  ["heap-top-k", "Heap / top-k"],
  ["two-heaps", "Two heaps"],
  ["intervals", "Intervals"],
  ["greedy", "Greedy"],
  ["backtracking", "Backtracking"],
  ["graph-bfs", "Graph BFS"],
  ["graph-dfs", "Graph DFS"],
  ["multi-source-bfs", "Multi-source BFS"],
  ["topological-sort", "Topological sort"],
  ["union-find", "Union-find"],
  ["dijkstra", "Dijkstra"],
  ["bellman-ford", "Bellman-Ford"],
  ["mst", "Minimum spanning tree"],
  ["dp-1d", "1-D DP"],
  ["dp-2d", "2-D DP"],
  ["knapsack", "Knapsack"],
  ["lis-dp", "LIS-style DP"],
  ["interval-dp", "Interval DP"],
  ["bit-manipulation", "Bit manipulation"],
  ["math-geometry", "Math & geometry"],
  ["design", "Design (data structure)"],
].map(([id, name]) => ({ id: id!, name: name! }));

export const PATTERN_BY_ID: ReadonlyMap<string, Pattern> = new Map(PATTERNS.map((p) => [p.id, p]));

export * from "./lists";
export * from "./topics";
