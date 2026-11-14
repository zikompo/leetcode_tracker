import { describe, expect, it } from "vitest";
import { isSolutionTab, parseProblemUrl } from "../url";
import { parseMetadataResponse } from "../metadata";
import question from "../__fixtures__/graphql-question.json";

describe("parseProblemUrl", () => {
  it.each([
    ["https://leetcode.com/problems/two-sum/", { slug: "two-sum", tab: "description" }],
    ["https://leetcode.com/problems/two-sum/description/", { slug: "two-sum", tab: "description" }],
    ["https://leetcode.com/problems/two-sum/editorial/", { slug: "two-sum", tab: "editorial" }],
    [
      "https://leetcode.com/problems/two-sum/solutions/123/abc/",
      { slug: "two-sum", tab: "solutions" },
    ],
    [
      "https://leetcode.com/problems/two-sum/submissions/1234/",
      { slug: "two-sum", tab: "submissions" },
    ],
    ["https://leetcode.com/problems/two-sum/whatever?x=1", { slug: "two-sum", tab: "other" }],
  ])("%s", (url, expected) => expect(parseProblemUrl(url)).toEqual(expected));

  it.each([
    "https://leetcode.com/problemset/",
    "https://leetcode.cn/problems/two-sum/",
    "not a url",
    "https://leetcode.com/problems/",
  ])("rejects %s", (url) => expect(parseProblemUrl(url)).toBeNull());

  it("flags solution tabs", () => {
    expect(isSolutionTab("editorial")).toBe(true);
    expect(isSolutionTab("solutions")).toBe(true);
    expect(isSolutionTab("description")).toBe(false);
  });
});

describe("parseMetadataResponse", () => {
  it("parses the GraphQL question payload", () => {
    expect(parseMetadataResponse(question)).toEqual({
      slug: "two-sum",
      frontendId: "1",
      title: "Two Sum",
      difficulty: "Easy",
      url: "https://leetcode.com/problems/two-sum/",
      leetcodeTopics: ["Array", "Hash Table"],
      isPaidOnly: false,
    });
  });
  it("returns null for missing questions or bad shapes", () => {
    expect(parseMetadataResponse({ data: { question: null } })).toBeNull();
    expect(parseMetadataResponse({ errors: [] })).toBeNull();
  });
});
