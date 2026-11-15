import { describe, expect, it } from "vitest";
import type { Attempt, CustomList, MockInterview, Problem, Settings } from "@leettrack/core";
import { DEFAULT_SETTINGS } from "@leettrack/core";
import type { PullResult, Remote, SyncBatch } from "./remote";
import { memoryRepo } from "./repo";
import { createSync, memorySyncState } from "./sync";

/** An in-memory server with the same rules as sync_push: newest wins, server timestamps. */
function fakeServer() {
  let tick = 0;
  const stamp = () => new Date(Date.UTC(2026, 0, 1) + ++tick * 1000).toISOString();
  type Row<T> = { data: T; at: string };
  const tables = {
    attempts: new Map<string, Row<Attempt>>(),
    problems: new Map<string, Row<Problem>>(),
    settings: new Map<string, Row<Settings>>(),
    lists: new Map<string, Row<CustomList>>(),
    mocks: new Map<string, Row<MockInterview>>(),
  };
  const upsert = <T extends { updatedAt: string }>(
    t: Map<string, Row<T>>,
    key: string,
    data: T,
  ) => {
    const cur = t.get(key);
    if (!cur || cur.data.updatedAt < data.updatedAt) t.set(key, { data, at: stamp() });
  };
  const pushes: SyncBatch[] = [];
  const remote: Remote = {
    async push(b) {
      pushes.push(b);
      b.attempts.forEach((a) => upsert(tables.attempts, a.id, a));
      b.problems.forEach((p) => upsert(tables.problems, p.slug, p));
      if (b.settings) upsert(tables.settings, "me", b.settings);
      b.lists.forEach((l) => upsert(tables.lists, l.id, l));
      b.mocks.forEach((m) => upsert(tables.mocks, m.id, m));
    },
    async pull(since): Promise<PullResult> {
      const fresh = <T>(t: Map<string, Row<T>>) =>
        [...t.values()].filter((r) => !since || r.at > since);
      const all = [
        ...fresh(tables.attempts),
        ...fresh(tables.problems),
        ...fresh(tables.settings),
        ...fresh(tables.lists),
        ...fresh(tables.mocks),
      ];
      const settings = fresh(tables.settings)[0]?.data;
      return {
        attempts: fresh(tables.attempts).map((r) => r.data),
        problems: fresh(tables.problems).map((r) => r.data),
        lists: fresh(tables.lists).map((r) => r.data),
        mocks: fresh(tables.mocks).map((r) => r.data),
        ...(settings ? { settings } : {}),
        cursor:
          all
            .map((r) => r.at)
            .sort()
            .at(-1) ?? since,
      };
    },
  };
  return { remote, tables, pushes };
}

const attempt = (
  id: string,
  updatedAt = "2026-01-01T00:00:00.000Z",
  over: Partial<Attempt> = {},
): Attempt => ({
  id,
  problemSlug: "two-sum",
  startedAt: updatedAt,
  endedAt: updatedAt,
  activeSeconds: 60,
  isCold: true,
  kind: "full",
  outcome: "solved_independently",
  helpLevel: "none",
  viewedSolutionDetected: false,
  optimality: "optimal",
  suggestedRating: 3,
  rating: 3,
  submissions: [],
  createdAt: updatedAt,
  updatedAt,
  ...over,
});
const problem = (updatedAt: string, over: Partial<Problem> = {}): Problem => ({
  slug: "two-sum",
  frontendId: "1",
  title: "Two Sum",
  difficulty: "Easy",
  url: "https://leetcode.com/problems/two-sum/",
  leetcodeTopics: [],
  patterns: [],
  suggestedPatterns: [],
  lists: [],
  updatedAt,
  ...over,
});

/** A device: its own local storage and sync state, talking to the shared server. */
function device(remote: Remote, clockIso = "2026-02-01T00:00:00.000Z") {
  const repo = memoryRepo();
  const state = memorySyncState();
  const clock = { now: new Date(clockIso) };
  return { repo, state, clock, sync: createSync({ repo, remote, state, clock: () => clock.now }) };
}

describe("sync", () => {
  it("pushes everything logged before signing in, then only what changed", async () => {
    const server = fakeServer();
    const d = device(server.remote);
    await d.repo.putAttempts([attempt("a1"), attempt("a2")]);
    await d.repo.putProblems([problem("2026-01-01T00:00:00.000Z")]);
    const first = await d.sync.run();
    expect(first.pushed).toBe(3);
    expect(server.tables.attempts.size).toBe(2);

    expect((await d.sync.run()).pushed).toBe(0); // nothing new

    d.clock.now = new Date("2026-02-02T00:00:00.000Z");
    await d.repo.putAttempts([attempt("a3", "2026-02-01T12:00:00.000Z")]);
    const third = await d.sync.run();
    expect(third.pushed).toBe(1);
    expect(server.pushes.at(-1)!.attempts.map((a) => a.id)).toEqual(["a3"]);
  });

  it("brings another device's work in, and the newer edit wins", async () => {
    const server = fakeServer();
    const laptop = device(server.remote);
    const desktop = device(server.remote);
    await laptop.repo.putAttempts([attempt("from-laptop")]);
    await laptop.repo.putProblems([problem("2026-01-01T00:00:00.000Z", { patterns: ["old"] })]);
    await laptop.sync.run();

    const pulled = await desktop.sync.run();
    expect(pulled.changed).toBe(true);
    expect((await desktop.repo.allAttempts()).map((a) => a.id)).toEqual(["from-laptop"]);

    // Desktop edits the problem later; laptop's stale copy doesn't overwrite it.
    await desktop.repo.putProblems([
      problem("2026-01-05T00:00:00.000Z", {
        statusOverride: { status: "fully_solved", at: "2026-01-05T00:00:00.000Z" },
      }),
    ]);
    desktop.clock.now = new Date("2026-02-03T00:00:00.000Z");
    await desktop.sync.run();
    await laptop.sync.run();
    expect((await laptop.repo.getProblem("two-sum"))?.statusOverride?.status).toBe("fully_solved");
    expect(server.tables.problems.get("two-sum")!.data.updatedAt).toBe("2026-01-05T00:00:00.000Z");
  });

  it("syncs settings and list deletes", async () => {
    const server = fakeServer();
    const a = device(server.remote);
    const b = device(server.remote);
    const list: CustomList = {
      id: "l1",
      name: "Mine",
      slugs: ["two-sum"],
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    await a.repo.putSettings({
      ...DEFAULT_SETTINGS,
      dailyNewLimit: 7,
      updatedAt: "2026-01-02T00:00:00.000Z",
    });
    await a.repo.putCustomLists([list]);
    await a.sync.run();
    await b.sync.run();
    expect((await b.repo.getSettings())?.dailyNewLimit).toBe(7);
    expect(await b.repo.getCustomLists()).toEqual([list]);

    await a.repo.putCustomLists([
      { ...list, deleted: true, updatedAt: "2026-01-03T00:00:00.000Z" },
    ]);
    a.clock.now = new Date("2026-02-02T00:00:00.000Z");
    await a.sync.run();
    await b.sync.run();
    expect((await b.repo.getCustomLists())[0]?.deleted).toBe(true);
  });

  it("syncs mock interviews, edits and deletes included", async () => {
    const server = fakeServer();
    const a = device(server.remote);
    const b = device(server.remote);
    const mock: MockInterview = {
      id: "m1",
      date: "2026-10-10",
      notes: "two pointers",
      updatedAt: "2026-01-01T00:00:00.000Z",
    };
    await a.repo.putMocks([mock]);
    await a.sync.run();
    await b.sync.run();
    expect(await b.repo.getMocks()).toEqual([mock]);

    await b.repo.putMocks([{ ...mock, deleted: true, updatedAt: "2026-01-02T00:00:00.000Z" }]);
    b.clock.now = new Date("2026-02-02T00:00:00.000Z");
    await b.sync.run();
    await a.sync.run();
    expect((await a.repo.getMocks())[0]?.deleted).toBe(true);
  });

  it("records the error and keeps its place when the server fails", async () => {
    const server = fakeServer();
    const failing: Remote = {
      push: async () => {
        throw new Error("Couldn't upload: offline");
      },
      pull: server.remote.pull,
    };
    const d = device(failing);
    await d.repo.putAttempts([attempt("a1")]);
    await expect(d.sync.run()).rejects.toThrow(/offline/);
    const state = await d.state.get();
    expect(state.lastError).toMatch(/offline/);
    expect(state.synced).toBeUndefined(); // so the next try pushes it again
  });

  it("pushes records imported later even when they carry old timestamps", async () => {
    const server = fakeServer();
    const d = device(server.remote, "2026-06-01T00:00:00.000Z");
    await d.sync.run();
    await d.repo.putAttempts([attempt("from-old-export", "2025-03-01T00:00:00.000Z")]);
    expect((await d.sync.run()).pushed).toBe(1);
    expect(server.tables.attempts.has("from-old-export")).toBe(true);
  });
});
