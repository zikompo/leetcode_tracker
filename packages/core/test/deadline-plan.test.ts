import { describe, expect, it } from "vitest";
import {
  buildPlan,
  buildQueue,
  daysUntil,
  deadlineReview,
  groupByPattern,
  noNewProblemsFor,
  paceOf,
  settingsSchema,
  upcomingTargets,
  type TargetDate,
} from "../src";

// Local times, so "today" doesn't depend on the machine's time zone.
const NOW = new Date(2026, 4, 20, 12); // 2026-05-20
const local = (day: number, hour = 9) => new Date(2026, 4, day, hour).toISOString();
const target = (date: string, over: Partial<TargetDate> = {}): TargetDate => ({
  id: date,
  label: `Interview ${date}`,
  date,
  listIds: [],
  ...over,
});
const opts = (r: number) => ({
  bufferDays: 2,
  minRecall: 0.9,
  retrievabilityAt: () => r,
});

describe("target dates", () => {
  it("counts whole local days and keeps only upcoming targets, soonest first", () => {
    expect(daysUntil("2026-05-20", NOW)).toBe(0);
    expect(daysUntil("2026-05-30", NOW)).toBe(10);
    expect(daysUntil("2026-05-19", NOW)).toBe(-1);
    const ts = [target("2026-06-10"), target("2026-05-19"), target("2026-05-25")];
    expect(upcomingTargets(ts, NOW).map((t) => t.date)).toEqual(["2026-05-25", "2026-06-10"]);
  });

  it("stops new problems in the last N days before a target", () => {
    expect(noNewProblemsFor([target("2026-05-23")], NOW, 2)).toBeUndefined();
    expect(noNewProblemsFor([target("2026-05-22")], NOW, 2)?.date).toBe("2026-05-22");
    expect(noNewProblemsFor([target("2026-05-20")], NOW, 2)?.date).toBe("2026-05-20");
    expect(noNewProblemsFor([target("2026-05-22")], NOW, 0)).toBeUndefined();
  });
});

describe("deadlineReview", () => {
  const card = (due: string, lastReview = local(1)) => ({ due, lastReview });

  it("brings a shaky card forward to the buffer before the interview", () => {
    const r = deadlineReview(card(local(31)), [target("2026-05-28")], NOW, opts(0.7));
    expect(r?.target.date).toBe("2026-05-28");
    expect(new Date(r!.due)).toEqual(new Date(2026, 4, 26));
  });

  it("leaves cards alone that are due before the interview or will still be remembered", () => {
    expect(deadlineReview(card(local(25)), [target("2026-05-28")], NOW, opts(0.5))).toBeUndefined();
    expect(
      deadlineReview(card(local(31)), [target("2026-05-28")], NOW, opts(0.95)),
    ).toBeUndefined();
  });

  it("is due today when the buffer has already started, unless reviewed inside it", () => {
    const soon = [target("2026-05-21")];
    const r = deadlineReview(card(local(31)), soon, NOW, opts(0.5));
    expect(new Date(r!.due)).toEqual(new Date(2026, 4, 20));
    expect(deadlineReview(card(local(31), local(19, 18)), soon, NOW, opts(0.5))).toBeUndefined();
  });

  it("ignores past interviews", () => {
    expect(deadlineReview(card(local(31)), [target("2026-05-10")], NOW, opts(0.1))).toBeUndefined();
  });
});

describe("queue with interview dates", () => {
  it("labels extra reviews and offers no new problems when an interview is close", () => {
    const t = target("2026-05-21");
    const q = buildQueue({
      now: NOW,
      reviews: [
        {
          slug: "a",
          card: {
            problemSlug: "a",
            due: local(20, 0),
            stability: 5,
            stabilityFast: 1,
            difficulty: 5,
            reps: 2,
            lapses: 0,
            state: "review",
          },
          attempts: [],
          patterns: [],
          forTarget: t,
        },
      ],
      newCandidates: [{ slug: "n", title: "n", frontendId: "1", difficulty: "Easy", patterns: [] }],
      startedSlugs: new Set(),
      attempts: [],
      settings: { dailyNewLimit: 3, dailyReviewLimit: 20 },
      retrievabilityOf: () => 0.8,
      noNewFor: t,
    });
    expect(q.items.map((i) => i.slug)).toEqual(["a"]);
    expect(q.items[0]!.forTarget?.label).toBe(t.label);
    expect(q.noNewFor?.date).toBe("2026-05-21");
  });
});

describe("groupByPattern", () => {
  it("keeps each pattern's problems together in first-seen order", () => {
    const items = [
      { slug: "a", patterns: ["window"] },
      { slug: "b", patterns: ["heap"] },
      { slug: "c", patterns: ["window"] },
      { slug: "d", patterns: [] },
      { slug: "e", patterns: ["heap", "window"] },
    ];
    expect(groupByPattern(items).map((i) => i.slug)).toEqual(["a", "c", "b", "e", "d"]);
  });
});

describe("buildPlan", () => {
  const remaining = ["a", "b", "c", "d", "e", "f", "g"];

  it("fills learn days at the daily limit and keeps the last days for reviews", () => {
    const plan = buildPlan({
      now: NOW,
      target: "2026-05-25",
      remaining,
      dailyNewLimit: 2,
      noNewDays: 2,
      newDoneToday: 1,
      reviewsOn: (d) => (d === "2026-05-21" ? 4 : 0),
    });
    expect(plan.days.map((d) => [d.date, d.kind, d.problems.join("")])).toEqual([
      ["2026-05-20", "learn", "a"],
      ["2026-05-21", "learn", "bc"],
      ["2026-05-22", "learn", "de"],
      ["2026-05-23", "review", ""],
      ["2026-05-24", "review", ""],
      ["2026-05-25", "target", ""],
    ]);
    expect(plan.days[1]!.reviews).toBe(4);
    expect(plan.learnDays).toBe(3);
    expect(plan.unplanned).toBe(2);
    expect(plan.neededPerDay).toBe(3);
    expect(plan.finishesOn).toBeUndefined();
  });

  it("shares the daily limit with other plans and keeps other interviews' quiet days", () => {
    const plan = buildPlan({
      now: NOW,
      target: "2026-05-26",
      remaining,
      dailyNewLimit: 2,
      noNewDays: 1,
      newDoneToday: 0,
      takenOn: (d) => (d === "2026-05-20" ? 2 : d === "2026-05-21" ? 1 : 0),
      quietOn: (d) => (d === "2026-05-22" ? "Phone screen" : undefined),
    });
    expect(plan.days.map((d) => [d.kind, d.problems.join(""), d.quietFor ?? ""])).toEqual([
      ["learn", "", ""],
      ["learn", "a", ""],
      ["review", "", "Phone screen"],
      ["learn", "bc", ""],
      ["learn", "de", ""],
      ["review", "", ""],
      ["target", "", ""],
    ]);
    expect(plan.learnDays).toBe(4);
  });

  it("says when everything fits", () => {
    const plan = buildPlan({
      now: NOW,
      target: "2026-06-10",
      remaining,
      dailyNewLimit: 3,
      noNewDays: 2,
      newDoneToday: 0,
    });
    expect(plan.unplanned).toBe(0);
    expect(plan.finishesOn).toBe("2026-05-22");
    expect(plan.days.at(-1)!.kind).toBe("target");
  });
});

describe("paceOf", () => {
  const base = { now: NOW, target: "2026-05-31", noNewDays: 0 };

  it("draws actual against a straight line to the whole list", () => {
    // Set on the 11th with 10 problems; last learn day is the 30th, so 20 days at 0.5 a day.
    const startedAt = Array.from({ length: 10 }, (_, i) => (i < 4 ? local(12 + i) : null));
    const pace = paceOf({ ...base, start: new Date(2026, 4, 11), startedAt });
    expect(pace.points[0]).toEqual({ date: "2026-05-11", actual: 0, needed: 0.5 });
    expect(pace.points.at(-2)!.needed).toBe(10);
    expect(pace.points.at(-1)).toEqual({ date: "2026-05-31", needed: 10 });
    expect(pace.points.find((p) => p.date === "2026-05-20")).toEqual({
      date: "2026-05-20",
      actual: 4,
      needed: 5,
    });
    expect(pace.done).toBe(4);
    expect(pace.ahead).toBe(0); // needed 4.5 by last night, 5 by tonight: on pace
  });

  it("is behind when short of yesterday's mark and ahead once past today's", () => {
    const start = new Date(2026, 4, 11);
    const none = Array.from({ length: 10 }, () => null);
    expect(paceOf({ ...base, start, startedAt: none }).ahead).toBe(-4);
    const lots = Array.from({ length: 10 }, (_, i) => (i < 8 ? local(12) : null));
    expect(paceOf({ ...base, start, startedAt: lots }).ahead).toBe(3);
  });

  it("starts from what was already done when the target was set", () => {
    const startedAt = [local(1), local(2), null, null];
    const pace = paceOf({ ...base, now: NOW, start: NOW, target: "2026-05-21", startedAt });
    expect(pace.points[0]!.needed).toBe(4); // one learn day (today) for the last two
    expect(pace.ahead).toBe(0); // today is the only day for them, and it isn't over
  });
});

describe("settings", () => {
  it("defaults the interview settings for older saved settings", () => {
    const s = settingsSchema.parse({ panelAutoOpen: "accepted", updatedAt: local(1) });
    expect(s.targetBufferDays).toBe(2);
    expect(s.targetNoNewDays).toBe(2);
    expect(s.targetRetention).toBe(0.95);
    expect(s.targetDates).toBeUndefined();
  });
});
