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

describe("custom lists", () => {
  it("merge by id, newest wins, deletes included", async () => {
    const { mergeCustomLists } = await import("../src");
    const a = { id: "l1", name: "Graphs", slugs: ["a"], updatedAt: "2026-01-01T00:00:00.000Z" };
    const gone = { ...a, deleted: true, updatedAt: "2026-01-02T00:00:00.000Z" };
    const b = { id: "l2", name: "DP", slugs: [], updatedAt: "2026-01-01T00:00:00.000Z" };
    expect(mergeCustomLists([a], [gone, b])).toEqual([gone, b]);
    expect(mergeCustomLists([gone], [a])).toEqual([gone]);
  });
});

describe("mock interviews", () => {
  it("merge by id, newest wins, and round-trip through an export", async () => {
    const { mergeMocks, buildExport, parseExport, DEFAULT_SETTINGS } = await import("../src");
    const m = {
      id: "m1",
      date: "2026-10-10",
      problem: "two-sum",
      outcome: "passed" as const,
      notes: "Fine",
      updatedAt: "2026-10-10T12:00:00.000Z",
    };
    const edited = { ...m, notes: "Fine, but slow", updatedAt: "2026-10-11T12:00:00.000Z" };
    expect(mergeMocks([edited], [m])).toEqual([edited]);
    expect(mergeMocks([m], [{ ...edited, deleted: true }])[0]!.deleted).toBe(true);

    const file = buildExport({
      problems: [],
      attempts: [],
      settings: DEFAULT_SETTINGS,
      mocks: [m],
    });
    const parsed = parseExport(JSON.stringify(file));
    expect(parsed.ok && parsed.data.mocks).toEqual([m]);
    const bad = { ...file, mocks: [{ ...m, date: "10/10/2026" }] };
    expect(parseExport(JSON.stringify(bad)).ok).toBe(false);
  });
});
