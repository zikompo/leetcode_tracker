import { describe, expect, it } from "vitest";
import { DEFAULT_SETTINGS, type Attempt, type Problem, type Settings } from "@leettrack/core";
import {
  buildSnapshot,
  cardSummary,
  clueJournal,
  countdowns,
  queueFrom,
  targetsFrom,
} from "../src";

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
const problem = (slug: string, suggestedPatterns: string[], patterns: string[] = []): Problem => ({
  slug,
  frontendId: "",
  title: slug.toUpperCase(),
  difficulty: "Medium",
  url: "",
  leetcodeTopics: [],
  patterns,
  suggestedPatterns,
  lists: [],
  updatedAt: "2026-01-01T00:00:00.000Z",
});
const NOW = new Date(2026, 10, 14, 12); // 2026-11-14
const day = (d: number) => new Date(2026, 10, d, 9);
const LIST = { id: "prep", name: "Prep", slugs: ["a", "b", "c", "d", "e"], updatedAt: "x" };
const snapshot = (
  settings: Partial<Settings>,
  attempts: Attempt[] = [],
  problems: Problem[] = [],
) =>
  buildSnapshot(
    {
      problems: [
        problem("a", ["window"]),
        problem("b", ["heap"]),
        problem("c", ["window"]),
        problem("d", ["heap"]),
        problem("e", ["window"]),
        ...problems,
      ],
      attempts,
      settings: { ...DEFAULT_SETTINGS, activeLists: [], ...settings },
      customLists: [LIST],
    },
    NOW,
  );

describe("targetsFrom", () => {
  it("plans what's left of the target's lists, one pattern at a time, with pace", () => {
    const snap = snapshot(
      {
        dailyNewLimit: 2,
        targetDates: [
          {
            id: "t1",
            label: "Onsite",
            date: "2026-11-20",
            listIds: ["prep"],
            createdAt: day(10).toISOString(),
          },
          { id: "old", label: "Past", date: "2026-11-01", listIds: [] },
        ],
      },
      [attempt("a", day(11))],
    );
    const [view, ...rest] = targetsFrom(snap);
    expect(rest).toEqual([]);
    expect(view).toMatchObject({
      daysLeft: 6,
      lists: [{ id: "prep", name: "Prep" }],
      total: 5,
      started: 1,
      newStopsOn: "2026-11-18",
    });
    const learn = view!.plan.days.filter((d) => d.kind === "learn");
    expect(learn.map((d) => d.problems.map((p) => p.slug))).toEqual([
      ["b", "d"],
      ["c", "e"],
      [],
      [],
    ]);
    expect(view!.plan.finishesOn).toBe("2026-11-15");
    expect(view!.pace.done).toBe(1);
    expect(countdowns(snap)).toEqual([
      { id: "t1", label: "Onsite", date: "2026-11-20", daysLeft: 6 },
    ]);
  });

  it("plans later interviews around earlier ones", () => {
    const snap = snapshot({
      dailyNewLimit: 2,
      targetNoNewDays: 1,
      targetDates: [
        { id: "late", label: "Onsite", date: "2026-11-24", listIds: ["prep"] },
        { id: "soon", label: "Phone", date: "2026-11-16", listIds: ["prep"] },
      ],
    });
    const [soon, late] = targetsFrom(snap);
    const learn = (v: typeof soon) =>
      v!.plan.days
        .filter((d) => d.problems.length)
        .map((d) => [d.date, d.problems.map((p) => p.slug)]);
    expect(learn(soon)).toEqual([["2026-11-14", ["a", "c"]]]);
    // Phone screen's quiet day (the 15th) and the day itself have no new problems.
    expect(late!.plan.days.find((d) => d.date === "2026-11-15")).toMatchObject({
      kind: "review",
      quietFor: "Phone",
    });
    expect(learn(late)).toEqual([
      ["2026-11-17", ["e", "b"]],
      ["2026-11-18", ["d"]],
    ]);
  });

  it("uses the active lists when the target names none", () => {
    const snap = snapshot({
      activeLists: ["prep"],
      targetDates: [{ id: "t", label: "Phone screen", date: "2026-12-01", listIds: [] }],
    });
    expect(targetsFrom(snap)[0]).toMatchObject({ total: 5, lists: [{ id: "prep" }] });
  });
});

describe("queue with an interview close by", () => {
  // Reviewed on 20 and 24 Oct: due 18 Nov, recall about 0.9 on the 16th.
  const attempts = [
    attempt("x", new Date(2026, 9, 20, 12)),
    attempt("x", new Date(2026, 9, 24, 12)),
  ];

  it("brings a shaky problem forward and offers no new problems", () => {
    const snap = snapshot(
      {
        activeLists: ["prep"],
        targetDates: [{ id: "t", label: "Onsite", date: "2026-11-16", listIds: [] }],
      },
      attempts,
    );
    const q = queueFrom(snap);
    expect(q.items.map((i) => [i.slug, i.forTarget?.label])).toEqual([["x", "Onsite"]]);
    expect(q.noNewFor?.label).toBe("Onsite");
    expect(cardSummary(snap, "x")).toMatchObject({ isDue: true, forTarget: "Onsite" });
    expect(targetsFrom(snap)[0]!.extraReviews).toBe(1);
  });

  it("leaves the schedule alone without an interview, and offers new problems from the plan", () => {
    const plain = queueFrom(snapshot({ activeLists: ["prep"] }, attempts));
    expect(plain.items.map((i) => i.slug)).toEqual(["a", "b", "c"]);
    const planned = queueFrom(
      snapshot(
        { targetDates: [{ id: "t", label: "Later", date: "2026-12-20", listIds: ["prep"] }] },
        attempts,
      ),
    );
    expect(planned.items.map((i) => i.slug)).toEqual(["a", "c", "e"]); // window problems first
  });
});

describe("clueJournal", () => {
  it("groups clues by pattern, newest first, with unpatterned ones last", () => {
    const snap = snapshot(
      {},
      [
        attempt("a", day(1), { patternClue: "contiguous subarray" }),
        attempt("a", day(5), { patternClue: "  longest substring  " }),
        attempt("b", day(3), { patternClue: "k largest" }),
        attempt("c", day(4)),
        attempt("zz", day(6), { patternClue: "no idea" }),
      ],
      [problem("b", [], ["heap", "window"]), problem("zz", [])],
    );
    const groups = clueJournal(snap);
    expect(groups.map((g) => [g.patternId, g.entries.map((e) => e.clue)])).toEqual([
      ["heap", ["k largest"]],
      ["window", ["longest substring", "k largest", "contiguous subarray"]],
      ["", ["no idea"]],
    ]);
    expect(groups.at(-1)!.name).toBe("No pattern yet");
  });
});
