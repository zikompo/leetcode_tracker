import { describe, expect, it } from "vitest";
import type { Attempt } from "@leettrack/core";
import { createService } from "./service";
import { memoryRepo, memorySessionStore } from "./repo";

const meta = {
  slug: "two-sum",
  frontendId: "1",
  title: "Two Sum",
  difficulty: "Easy" as const,
  url: "https://leetcode.com/problems/two-sum/",
  leetcodeTopics: ["Array"],
  isPaidOnly: false,
};

const attempt = (over: Partial<Attempt> = {}): Attempt => ({
  id: crypto.randomUUID(),
  problemSlug: "two-sum",
  startedAt: "2026-11-14T10:00:00.000Z",
  endedAt: "2026-11-14T10:20:00.000Z",
  activeSeconds: 900,
  isCold: true,
  kind: "full",
  outcome: "solved_independently",
  helpLevel: "none",
  viewedSolutionDetected: false,
  optimality: "optimal",
  suggestedRating: 3,
  rating: 3,
  submissions: [],
  createdAt: "2026-11-14T10:20:00.000Z",
  updatedAt: "2026-11-14T10:20:00.000Z",
  ...over,
});

const setup = () =>
  createService(memoryRepo(), memorySessionStore(), () => new Date("2026-11-14T12:00:00.000Z"));

describe("service", () => {
  it("stores metadata and attempts, and derives status", async () => {
    const s = setup();
    expect((await s.getProblemState("two-sum")).status.status).toBe("unseen");
    await s.upsertProblemMeta(meta);
    await s.saveAttempt({
      attempt: attempt({ outcome: "not_solved", optimality: undefined }),
      patterns: ["arrays-hashing"],
    });
    const state = await s.saveAttempt({
      attempt: attempt({ startedAt: "2026-11-15T00:00:00.000Z" }),
      patterns: ["arrays-hashing"],
    });
    expect(state.attempts).toHaveLength(2);
    expect(state.status).toMatchObject({ status: "fully_solved", optimality: "optimal" });
    expect(state.problem?.patterns).toEqual(["arrays-hashing"]);
    expect(state.problem?.title).toBe("Two Sum");
  });

  it("keeps user fields when metadata refreshes", async () => {
    const s = setup();
    await s.saveAttempt({ attempt: attempt(), patterns: ["two-pointers"] });
    const st = await s.upsertProblemMeta(meta);
    expect(st.problem).toMatchObject({ title: "Two Sum", patterns: ["two-pointers"] });
  });

  it("clears the session when an attempt is saved", async () => {
    const s = setup();
    await s.putSession({
      slug: "two-sum",
      startedAt: "x",
      lastActiveAt: "x",
      activeSeconds: 1,
      submissions: [],
      submissionIds: [],
      viewedSolutionDetected: false,
    });
    expect(await s.getSession("two-sum")).not.toBeNull();
    await s.saveAttempt({ attempt: attempt(), patterns: [] });
    expect(await s.getSession("two-sum")).toBeNull();
  });

  it("applies and clears manual overrides", async () => {
    const s = setup();
    let st = await s.setStatusOverride({
      slug: "two-sum",
      override: { status: "fully_solved", optimality: "optimal", at: "x" },
    });
    expect(st.status).toMatchObject({ status: "fully_solved", overridden: true });
    expect((await s.getStats()).fullySolved).toBe(1);
    st = await s.setStatusOverride({ slug: "two-sum", override: null });
    expect(st.status.status).toBe("unseen");
  });

  it("computes a speed median once enough timed solves exist", async () => {
    const s = setup();
    await s.upsertProblemMeta(meta);
    for (const secs of [60, 120, 300])
      await s.saveAttempt({ attempt: attempt({ activeSeconds: secs }), patterns: [] });
    expect((await s.getProblemState("two-sum")).medianSolveSeconds).toBe(120);
  });

  it("round-trips export → import into an empty store, and import is idempotent", async () => {
    const a = setup();
    await a.upsertProblemMeta(meta);
    await a.saveAttempt({ attempt: attempt({ notes: "hash map" }), patterns: ["arrays-hashing"] });
    await a.setSettings({ panelAutoOpen: "manual" });
    const json = await a.exportData();

    const b = setup();
    expect(await b.importData(json)).toEqual({
      attemptsAdded: 1,
      attemptsUpdated: 0,
      problemsMerged: 1,
    });
    expect(await b.importData(json)).toEqual({
      attemptsAdded: 0,
      attemptsUpdated: 0,
      problemsMerged: 0,
    });
    const st = await b.getProblemState("two-sum");
    expect(st.attempts[0]?.notes).toBe("hash map");
    expect(st.problem?.patterns).toEqual(["arrays-hashing"]);
    expect((await b.getSettings()).panelAutoOpen).toBe("manual");
  });

  it("rejects invalid imports", async () => {
    await expect(setup().importData("{}")).rejects.toThrow(/Not a LeetTrack export/);
  });

  it("creates custom pattern tags once, and reuses built-in ids", async () => {
    const s = setup();
    const a = await s.addCustomPattern("Matrix traversal");
    expect(a.id).toBe("matrix-traversal");
    const b = await s.addCustomPattern("matrix  traversal");
    expect(b.settings.customPatterns).toEqual([
      { id: "matrix-traversal", name: "Matrix traversal" },
    ]);
    const c = await s.addCustomPattern("Two pointers");
    expect(c.id).toBe("two-pointers");
    expect((await s.getSettings()).customPatterns).toHaveLength(1);
  });
});

describe("scheduling, queue and dashboard", () => {
  // A movable clock, in local time so "today" is the machine's day.
  const clockAt = (d: Date) => {
    const c = { now: d };
    return { c, service: createService(memoryRepo(), memorySessionStore(), () => c.now) };
  };
  const solve = (endedAt: Date, over: Partial<Attempt> = {}) =>
    attempt({
      startedAt: endedAt.toISOString(),
      endedAt: endedAt.toISOString(),
      createdAt: endedAt.toISOString(),
      ...over,
    });

  it("schedules a review, and the queue and badge count pick it up when due", async () => {
    const { c, service } = clockAt(new Date(2026, 10, 14, 12));
    const state = await service.saveAttempt({ attempt: solve(c.now), patterns: [] });
    expect(state.card).toMatchObject({ isDue: false, reps: 1, isLeech: false });
    const due = new Date(state.card!.due);
    expect(due.getTime()).toBeGreaterThan(c.now.getTime());

    expect((await service.getQueue()).items.filter((i) => i.kind === "review")).toHaveLength(0);
    c.now = new Date(due.getTime() + 3 * 86_400_000);
    const queue = await service.getQueue();
    expect(queue.items[0]).toMatchObject({ slug: "two-sum", kind: "review", overdueDays: 3 });
    expect((await service.getStats()).dueToday).toBe(1);
    expect((await service.getProblemState("two-sum")).card?.isDue).toBe(true);
  });

  it("fills today's new problems from the active list, skipping started ones", async () => {
    const { c, service } = clockAt(new Date(2026, 10, 14, 12));
    const before = await service.getQueue();
    expect(before.items.map((i) => i.kind)).toEqual(["new", "new", "new"]);
    const first = before.items[0]!.slug;
    await service.saveAttempt({ attempt: solve(c.now, { problemSlug: first }), patterns: [] });
    const after = await service.getQueue();
    expect(after.newDoneToday).toBe(1);
    expect(after.items.filter((i) => i.kind === "new")).toHaveLength(2);
    expect(after.items.some((i) => i.slug === first)).toBe(false);
  });

  it("flags leeches and keeps tags on quick reviews", async () => {
    const { c, service } = clockAt(new Date(2026, 10, 14, 12));
    for (let i = 0; i < 3; i++) {
      await service.saveAttempt({
        attempt: solve(new Date(2026, 10, 10 + i), {
          outcome: "not_solved",
          rating: 1,
          stuckNote: `try ${i}`,
        }),
        patterns: ["two-pointers"],
      });
    }
    await service.saveAttempt({
      attempt: solve(c.now, { kind: "quick", rating: 3 }),
      patterns: [],
    });
    const state = await service.getProblemState("two-sum");
    expect(state.card?.isLeech).toBe(true);
    expect(state.problem?.patterns).toEqual(["two-pointers"]);
    const dash = await service.getDashboard();
    expect(dash.leeches[0]).toMatchObject({ slug: "two-sum", againCount: 3 });
    expect(dash.leeches[0]!.stuckNotes).toHaveLength(3);
  });

  it("suggests patterns from seed data and LeetCode topics, and knows list membership", async () => {
    const { service } = clockAt(new Date(2026, 10, 14, 12));
    const state = await service.upsertProblemMeta({
      ...meta,
      leetcodeTopics: ["Array", "Hash Table"],
    });
    expect(state.suggestedPatterns).toEqual(["arrays-hashing"]);
    expect(state.problem?.lists).toEqual(["blind75", "neetcode150", "neetcode250"]);
  });

  it("reports list progress and pattern mastery", async () => {
    const { c, service } = clockAt(new Date(2026, 10, 14, 12));
    await service.saveAttempt({ attempt: solve(c.now), patterns: ["arrays-hashing"] });
    const dash = await service.getDashboard();
    expect(dash.lists.map((l) => [l.id, l.total, l.active])).toEqual([
      ["blind75", 75, false],
      ["neetcode150", 150, true],
      ["neetcode250", 250, false],
    ]);
    expect(dash.lists[1]!.byStatus.fully_solved).toBe(1);
    const arrays = dash.patterns.find((p) => p.pattern === "arrays-hashing")!;
    expect(arrays).toMatchObject({ attempted: 1, coldAttempts: 1, coldSolved: 1 });
    expect(arrays.coverage).toBeGreaterThan(0);
  });

  it("renames and merges patterns, rewriting problem tags", async () => {
    const { c, service } = clockAt(new Date(2026, 10, 14, 12));
    await service.saveAttempt({ attempt: solve(c.now), patterns: ["sliding-window-fixed"] });
    const renamed = await service.renamePattern({ id: "two-pointers", name: "Pointers" });
    expect(renamed.patternRenames).toEqual({ "two-pointers": "Pointers" });
    const merged = await service.mergePattern({
      from: "sliding-window-fixed",
      into: "sliding-window-variable",
    });
    expect(merged.patternMerges).toEqual({ "sliding-window-fixed": "sliding-window-variable" });
    expect((await service.getProblemState("two-sum")).problem?.patterns).toEqual([
      "sliding-window-variable",
    ]);
    await expect(
      service.mergePattern({ from: "sliding-window-variable", into: "sliding-window-fixed" }),
    ).rejects.toThrow(/same pattern/);
  });
});
