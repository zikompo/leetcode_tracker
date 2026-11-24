import { describe, expect, it } from "vitest";
import { parsePageLocation } from "../sites";

describe("parsePageLocation", () => {
  it("reads both sites' problem pages in LeetTrack's terms", () => {
    expect(parsePageLocation("https://leetcode.com/problems/two-sum/editorial/")).toEqual({
      site: "leetcode",
      slug: "two-sum",
      siteSlug: "two-sum",
      tab: "editorial",
      revealsSolution: true,
    });
    expect(parsePageLocation("https://neetcode.io/problems/two-integer-sum/question")).toEqual({
      site: "neetcode",
      slug: "two-sum",
      siteSlug: "two-integer-sum",
      tab: "question",
      revealsSolution: false,
    });
    expect(
      parsePageLocation("https://neetcode.io/problems/two-integer-sum/solution"),
    ).toMatchObject({ revealsSolution: true });
    expect(parsePageLocation("https://example.com/problems/two-sum/")).toBeNull();
  });
});
