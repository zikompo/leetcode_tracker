import { describe, expect, it } from "vitest";
import {
  LISTS,
  PATTERN_BY_ID,
  SEED_BY_SLUG,
  SEED_PROBLEMS,
  TOPIC_TO_PATTERN,
  listProblems,
  neetcodeUrl,
  patternsFromTopics,
  seedForNeetcodeSlug,
} from "../src";

describe("seed lists", () => {
  it("have the published sizes, nested as on neetcode.io", () => {
    expect(listProblems("blind75")).toHaveLength(75);
    expect(listProblems("neetcode150")).toHaveLength(150);
    expect(listProblems("neetcode250")).toHaveLength(250);
    const nc250 = new Set(listProblems("neetcode250").map((p) => p.slug));
    for (const p of listProblems("neetcode150")) expect(nc250.has(p.slug)).toBe(true);
    expect(LISTS.map((l) => l.id)).toEqual(["blind75", "neetcode150", "neetcode250"]);
  });
  it("have unique slugs and numeric LeetCode ids", () => {
    expect(SEED_BY_SLUG.size).toBe(SEED_PROBLEMS.length);
    for (const p of SEED_PROBLEMS) expect(p.frontendId).toMatch(/^[1-9]\d*$/);
    expect(SEED_BY_SLUG.get("contains-duplicate")).toMatchObject({
      frontendId: "217",
      difficulty: "Easy",
      lists: ["blind75", "neetcode150", "neetcode250"],
    });
  });
  it("only suggest patterns that exist in the taxonomy, and every problem gets one", () => {
    for (const p of SEED_PROBLEMS) {
      expect(p.suggestedPatterns.length, p.slug).toBeGreaterThan(0);
      for (const id of p.suggestedPatterns)
        expect(PATTERN_BY_ID.has(id), `${p.slug}: ${id}`).toBe(true);
    }
    for (const id of Object.values(TOPIC_TO_PATTERN)) expect(PATTERN_BY_ID.has(id), id).toBe(true);
  });
  it("refine coarse categories", () => {
    expect(SEED_BY_SLUG.get("koko-eating-bananas")?.suggestedPatterns).toEqual([
      "binary-search-answer",
    ]);
    expect(SEED_BY_SLUG.get("rotting-oranges")?.suggestedPatterns).toEqual(["multi-source-bfs"]);
    expect(patternsFromTopics(["Array", "Hash Table", "Hash Table", "Sliding Window"])).toEqual([
      "arrays-hashing",
      "sliding-window-variable",
    ]);
  });
});

describe("NeetCode slugs", () => {
  it("map neetcode.io's problem slugs to LeetCode's and back", () => {
    expect(seedForNeetcodeSlug("two-integer-sum")?.slug).toBe("two-sum");
    expect(seedForNeetcodeSlug("duplicate-integer")?.slug).toBe("contains-duplicate");
    expect(seedForNeetcodeSlug("two-sum")).toBeUndefined();
    expect(neetcodeUrl("two-sum")).toBe("https://neetcode.io/problems/two-integer-sum/question");
    expect(neetcodeUrl("not-a-seed-problem")).toBeUndefined();
    // Every problem has one, and no two share it.
    const slugs = SEED_PROBLEMS.map((p) => p.neetcodeSlug);
    expect(slugs.every(Boolean)).toBe(true);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
