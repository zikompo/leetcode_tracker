import { describe, expect, it } from "vitest";
import type { Attempt } from "@leettrack/core";
import {
  commitMessage,
  extensionFor,
  filesForAttempt,
  problemDir,
  renderReadme,
  shouldCommit,
} from "./render";

const at = (d: number) => new Date(2026, 10, d, 12).toISOString();
const attempt = (id: string, d: number, over: Partial<Attempt> = {}): Attempt => ({
  id,
  problemSlug: "two-sum",
  startedAt: at(d),
  endedAt: at(d),
  activeSeconds: 840,
  isCold: d === 1,
  kind: "full",
  outcome: "solved_independently",
  helpLevel: "none",
  viewedSolutionDetected: false,
  optimality: "optimal",
  suggestedRating: 3,
  rating: 3,
  submissions: [{ at: at(d), status: "Accepted" }],
  language: "python3",
  code: `# attempt ${id}`,
  createdAt: at(d),
  updatedAt: at(d),
  ...over,
});
const problem = {
  slug: "two-sum",
  frontendId: "1",
  title: "Two Sum",
  difficulty: "Easy",
  patterns: ["arrays-hashing"],
};
const names = (id: string) => (id === "arrays-hashing" ? "Arrays & hashing" : id);

describe("repo layout", () => {
  it("names folders and files the way the spec shows", () => {
    expect(problemDir(problem)).toBe("problems/0001-two-sum");
    expect(problemDir({ slug: "x" })).toBe("problems/x");
    expect(extensionFor("python3")).toBe("py");
    expect(extensionFor("cpp")).toBe("cpp");
    expect(extensionFor("golang")).toBe("go");
    expect(extensionFor("brainfuck")).toBe("txt");
  });

  it("writes the spec's commit message", () => {
    expect(commitMessage(problem, attempt("b", 3), 2)).toBe(
      "0001-two-sum: attempt 2, solved independently, optimal (14 min)",
    );
    expect(
      commitMessage(
        problem,
        attempt("c", 4, {
          outcome: "solved_with_help",
          helpLevel: "approach",
          optimality: "unsure",
        }),
        3,
      ),
    ).toBe("0001-two-sum: attempt 3, solved with help (key idea) (14 min)");
  });

  it("commits Accepted attempts with code only", () => {
    expect(shouldCommit(attempt("a", 1))).toBe(true);
    expect(
      shouldCommit(attempt("a", 1, { submissions: [{ at: at(1), status: "Wrong Answer" }] })),
    ).toBe(false);
    expect(shouldCommit(attempt("a", 1, { code: "  " }))).toBe(false);
  });
});

describe("filesForAttempt", () => {
  it("writes the README, the latest Accepted solution and this attempt's code in one go", () => {
    const first = attempt("a", 1, {
      notes: "Hash map | one pass",
      patternClue: "pairs → complement",
    });
    const second = attempt("b", 3, { language: "cpp", code: "// v2" });
    const failed = attempt("x", 5, {
      outcome: "not_solved",
      rating: 1,
      submissions: [],
      code: "// wip",
    });
    const { message, files } = filesForAttempt({
      problem,
      attempts: [second, failed, first],
      attempt: second,
      includeNotes: true,
      patternName: names,
    });
    expect(message).toBe("0001-two-sum: attempt 2, solved independently, optimal (14 min)");
    expect(files.map((f) => f.path)).toEqual([
      "problems/0001-two-sum/README.md",
      "problems/0001-two-sum/solution.cpp",
      "problems/0001-two-sum/attempts/2026-11-03-attempt-2.cpp",
    ]);
    const readme = files[0]!.content;
    expect(readme).toContain("# 1. Two Sum");
    expect(readme).toContain(
      "[LeetCode](https://leetcode.com/problems/two-sum/) · Easy · Patterns: Arrays & hashing",
    );
    expect(readme).toContain("| 3 | 2026-11-05 | not solved | 14m 00s | Again |");
    expect(readme).toContain("Hash map | one pass"); // notes sit outside the table
    expect(readme).toContain("**Clue:** pairs → complement");
  });

  it("can leave notes out of the README", () => {
    const readme = renderReadme(problem, [attempt("a", 1, { notes: "secret" })], {
      includeNotes: false,
      patternName: names,
    });
    expect(readme).not.toContain("secret");
    expect(readme).not.toContain("## Notes");
  });
});
