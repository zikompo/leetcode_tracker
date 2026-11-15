import { describe, expect, it } from "vitest";
import { buildSnapshot, fromPrepTracker, isPrepTracker, withTargetDates } from "../src";
import { DEFAULT_SETTINGS } from "@leettrack/core";

// Shaped like a real prep-tracker export; the content is made up.
const tracker = {
  v: 1,
  interview: "2026-10-23",
  interview2: "2026-10-23",
  updatedAt: Date.UTC(2026, 9, 24, 12),
  log: { "2026-10-02": { n: 3, r: 0 } },
  probs: {
    "binary-search": { status: "solved", countedOn: "2026-10-02", redo: null },
    "3sum": { status: "help", countedOn: "2026-10-16", redo: null, clean: true },
    "koko-eating-bananas": {
      status: "help",
      countedOn: "2026-10-04",
      redo: { stage: 2, due: "2026-10-12" },
    },
    "task-scheduler": {
      status: "help",
      countedOn: "2026-10-05",
      redo: { stage: 1, due: "2026-10-07" },
    },
    "car-fleet": { status: "help", countedOn: "2026-10-05", redo: { stage: 1, due: "2026-10-11" } },
    "two-sum": { status: "before" },
    "merge-intervals": {},
  },
  mocks: [{ id: "m1", date: "2026-10-10", notes: "Sliding window, took the full 45 minutes" }],
};

describe("fromPrepTracker", () => {
  const out = fromPrepTracker(tracker);
  const by = (slug: string) => out.attempts.filter((a) => a.problemSlug === slug);

  it("recognises the format", () => {
    expect(isPrepTracker(tracker)).toBe(true);
    expect(isPrepTracker({ app: "leettrack", problems: [] })).toBe(false);
    expect(() => fromPrepTracker({ probs: { x: { status: "maybe" } } })).toThrow(/prep tracker/);
  });

  it("maps statuses to attempts or a manual status", () => {
    expect(by("binary-search")).toMatchObject([
      { outcome: "solved_independently", isCold: true, rating: 3, activeSeconds: 0 },
    ]);
    expect(by("binary-search")[0]!.endedAt.startsWith("2026-10-0")).toBe(true);
    expect(by("two-sum")).toEqual([]);
    expect(out.problems).toMatchObject([
      { slug: "two-sum", title: "Two Sum", statusOverride: { status: "fully_solved" } },
    ]);
    expect(by("merge-intervals")).toEqual([]);
  });

  it("turns redos into review attempts on the tracker's ladder", () => {
    // Clean: needed help, then two clean redos two and seven days later.
    expect(by("3sum").map((a) => [a.outcome, a.rating, a.isCold])).toEqual([
      ["solved_with_help", 2, true],
      ["solved_independently", 3, false],
      ["solved_independently", 3, false],
    ]);
    const days = by("3sum").map((a) => new Date(a.endedAt).getDate());
    expect(days).toEqual([16, 18, 23]);
    // Second-stage redo pending: one clean redo, five days before it's due.
    expect(by("koko-eating-bananas")).toHaveLength(2);
    expect(new Date(by("koko-eating-bananas")[1]!.endedAt).getDate()).toBe(7);
    // First redo pending on schedule: nothing yet. Due later than that: a redo went badly.
    expect(by("task-scheduler")).toHaveLength(1);
    expect(by("car-fleet").map((a) => a.rating)).toEqual([2, 1]);
  });

  it("brings mocks and one interview date, and re-importing adds nothing new", () => {
    expect(out.mocks).toMatchObject([{ id: "tracker-m1", date: "2026-10-10" }]);
    expect(out.targetDates).toMatchObject([{ date: "2026-10-23", label: "Interview" }]);
    expect(withTargetDates(out.targetDates, out.targetDates)).toBeUndefined();
    expect(withTargetDates([], out.targetDates)).toHaveLength(1);
    const again = fromPrepTracker(tracker);
    expect(again.attempts.map((a) => a.id)).toEqual(out.attempts.map((a) => a.id));
  });

  it("replays into cards the scheduler can use", () => {
    const snap = buildSnapshot(
      { problems: out.problems, attempts: out.attempts, settings: DEFAULT_SETTINGS },
      new Date(2026, 10, 15),
    );
    expect(snap.cards.get("3sum")?.reps).toBe(3);
    expect(snap.cards.get("two-sum")).toBeUndefined();
  });
});
