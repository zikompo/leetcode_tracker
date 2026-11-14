import { describe, expect, it } from "vitest";
import { addCustomPattern, tagId } from "../src";

describe("tags", () => {
  it("slugifies names", () => {
    expect(tagId("Two Pointers!")).toBe("two-pointers");
    expect(tagId("  Arrays & Hashing ")).toBe("arrays-hashing");
    expect(tagId("!!!")).toBe("");
  });
  it("adds new custom tags and reuses existing ones", () => {
    const known = new Set(["two-pointers"]);
    const first = addCustomPattern([], "  Matrix   traversal ", known);
    expect(first).toEqual({
      id: "matrix-traversal",
      patterns: [{ id: "matrix-traversal", name: "Matrix traversal" }],
    });
    expect(addCustomPattern(first.patterns, "matrix traversal", known).patterns).toHaveLength(1);
    expect(addCustomPattern([], "Two pointers", known)).toEqual({
      id: "two-pointers",
      patterns: [],
    });
    expect(() => addCustomPattern([], "???", known)).toThrow();
  });
});
