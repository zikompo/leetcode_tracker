import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, buildExport, mergeAttempts, mergeProblems, parseExport } from "../src";
import { makeAttempt, makeProblem } from "./fixtures";

describe("mergeAttempts", () => {
  it("unions by id and keeps the newer edit", () => {
    const a = makeAttempt({ id: "1", notes: "old", updatedAt: "2026-01-01" });
    const b = makeAttempt({ id: "2" });
    const a2 = { ...a, notes: "new", updatedAt: "2026-01-02" };
    const merged = mergeAttempts([a, b], [a2, makeAttempt({ id: "3" })]);
    expect(merged.map((x) => x.id).sort()).toEqual(["1", "2", "3"]);
    expect(merged.find((x) => x.id === "1")?.notes).toBe("new");
    // older incoming edit does not win
    expect(mergeAttempts([a2], [a])[0]?.notes).toBe("new");
  });
});

describe("mergeProblems", () => {
  it("keeps the newer record per slug", () => {
    const p1 = makeProblem({ patterns: ["a"], updatedAt: "2026-01-02" });
    const p0 = makeProblem({ patterns: ["b"], updatedAt: "2026-01-01" });
    expect(mergeProblems([p1], [p0])[0]?.patterns).toEqual(["a"]);
    expect(mergeProblems([p0], [p1])[0]?.patterns).toEqual(["a"]);
  });
});

describe("export round trip", () => {
  it("parses what it builds", () => {
    const file = buildExport({
      problems: [makeProblem()],
      attempts: [makeAttempt()],
      settings: DEFAULT_SETTINGS,
    });
    const parsed = parseExport(JSON.stringify(file));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.data).toEqual(file);
  });
  it("rejects garbage", () => {
    expect(parseExport("nope")).toMatchObject({ ok: false });
    expect(parseExport(JSON.stringify({ app: "other" }))).toMatchObject({ ok: false });
    const bad = buildExport({
      problems: [],
      attempts: [{ ...makeAttempt(), rating: 7 as never }],
      settings: DEFAULT_SETTINGS,
    });
    expect(parseExport(JSON.stringify(bad))).toMatchObject({ ok: false });
  });
});
