import { describe, expect, it } from "vitest";
import { SPACE_COMPLEXITIES, TIME_COMPLEXITIES, normalizeComplexity } from "../src";

describe("normalizeComplexity", () => {
  it.each([
    ["O(N)", "O(n)"],
    ["O(1)", "O(1)"],
    ["O(log N)", "O(log n)"],
    ["O(logn)", "O(log n)"],
    ["O(NlogN)", "O(n log n)"],
    ["O(n * log(n))", "O(n log n)"],
    ["O(N^2)", "O(n²)"],
    ["O(n^3)", "O(n³)"],
    ["O(2^N)", "O(2ⁿ)"],
    ["O(n^k)", "O(nᵏ)"],
    ["O(m*n)", "O(m·n)"],
    ["O(M × N)", "O(m·n)"],
    ["O(V+E)", "O(V + E)"],
    ["n log n", "O(n log n)"],
    ["  O(n)  ", "O(n)"],
    ["O(n^5)", "O(n^5)"],
  ])("%s -> %s", (raw, expected) => {
    expect(normalizeComplexity(raw)).toBe(expected);
  });
  it("is undefined for empty input", () => {
    expect(normalizeComplexity("")).toBeUndefined();
    expect(normalizeComplexity("O()")).toBeUndefined();
    expect(normalizeComplexity(undefined)).toBeUndefined();
  });
  it("leaves every chip label unchanged", () => {
    for (const c of [...TIME_COMPLEXITIES, ...SPACE_COMPLEXITIES]) {
      expect(normalizeComplexity(c)).toBe(c);
    }
  });
});
