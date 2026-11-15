import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, type Attempt } from "@leettrack/core";
import { activity, buildSnapshot, listProgress, problemRows, queueFrom } from "../src";

const attempt = (slug: string, endedAt: Date, over: Partial<Attempt> = {}): Attempt => ({
  id: `${slug}-${endedAt.toISOString()}`,
  problemSlug: slug,
  startedAt: endedAt.toISOString(),
  endedAt: endedAt.toISOString(),
  activeSeconds: 600,
  isCold: true,
  kind: "full",
  outcome: "solved_independently",
  helpLevel: "none",
  viewedSolutionDetected: false,
  optimality: "optimal",
  suggestedRating: 3,
  rating: 3,
  submissions: [],
  createdAt: endedAt.toISOString(),
  updatedAt: endedAt.toISOString(),
  ...over,
});
const NOW = new Date(2026, 10, 14, 12); // a Saturday, local time

describe("activity", () => {
  it("counts attempts per local day in whole weeks, with the current streak", () => {
    const a = activity(
      [
        attempt("a", new Date(2026, 10, 14, 9)),
        attempt("b", new Date(2026, 10, 13, 9)),
        attempt("c", new Date(2026, 10, 13, 20)),
        attempt("d", new Date(2026, 10, 11, 9)),
      ],
      NOW,
      4,
    );
    expect(a.days).toHaveLength(4 * 7 - 1 + 1); // Sunday 3 weeks + 6 days ago .. today
    expect(new Date(`${a.days[0]!.date}T12:00:00`).getDay()).toBe(0);
    expect(a.days.at(-1)).toEqual({ date: "2026-11-14", count: 1 });
    expect(a.days.find((d) => d.date === "2026-11-13")?.count).toBe(2);
    expect(a.streak).toBe(2);
    expect(a).toMatchObject({ activeDays: 3, total: 4 });
  });
  it("keeps yesterday's streak alive until today ends", () => {
    expect(activity([attempt("a", new Date(2026, 10, 13, 9))], NOW).streak).toBe(1);
  });
});

describe("custom lists", () => {
  it("feed new problems when active, and get progress like seed lists", () => {
    const snap = buildSnapshot(
      {
        problems: [],
        attempts: [attempt("two-sum", new Date(2026, 10, 10))],
        settings: { ...DEFAULT_SETTINGS, activeLists: ["mine"] },
        customLists: [
          { id: "mine", name: "Mine", slugs: ["two-sum", "lru-cache"], updatedAt: "x" },
          { id: "gone", name: "Old", slugs: ["a"], deleted: true, updatedAt: "x" },
        ],
      },
      NOW,
    );
    expect(
      queueFrom(snap)
        .items.filter((i) => i.kind === "new")
        .map((i) => i.slug),
    ).toEqual(["lru-cache"]);
    const mine = listProgress(snap).find((l) => l.id === "mine")!;
    expect(mine).toMatchObject({ kind: "custom", active: true, total: 2 });
    expect(mine.byStatus.fully_solved + mine.byStatus.unseen).toBe(2);
    expect(listProgress(snap).some((l) => l.id === "gone")).toBe(false);
  });
});

describe("problemRows", () => {
  it("lists attempted and active-list problems, hiding suggestions until attempted", () => {
    const snap = buildSnapshot(
      {
        problems: [],
        attempts: [
          attempt("two-sum", new Date(2026, 10, 1), { outcome: "not_solved", rating: 1 }),
          attempt("two-sum", new Date(2026, 10, 5)),
        ],
        settings: DEFAULT_SETTINGS,
      },
      NOW,
    );
    const rows = problemRows(snap);
    expect(rows.length).toBe(150); // NeetCode 150 is active by default, Two Sum is in it
    const twoSum = rows.find((r) => r.slug === "two-sum")!;
    expect(twoSum).toMatchObject({
      title: "Two Sum",
      frontendId: "1",
      attempts: 2,
      bestOutcome: "solved_independently",
      status: "fully_solved",
      patterns: ["arrays-hashing"],
    });
    expect(twoSum.lists).toContain("blind75");
    expect(twoSum.nextDue).toBeDefined();
    const untouched = rows.find((r) => r.slug === "valid-anagram")!;
    expect(untouched).toMatchObject({ attempts: 0, status: "unseen", patterns: [] });
  });
});
