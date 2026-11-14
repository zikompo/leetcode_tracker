import { describe, expect, it } from "vitest";
import {
  buildQueue,
  interleave,
  isLeech,
  quickReviewEligible,
  type CardState,
  type QueueInput,
  type ReviewSource,
} from "../src";
import { makeAttempt } from "./fixtures";

// Local times, so "today" doesn't depend on the machine's time zone.
const NOW = new Date(2026, 4, 20, 12);
const local = (day: number, hour = 9) => new Date(2026, 4, day, hour).toISOString();

const card = (slug: string, due: string, stability = 5): CardState => ({
  problemSlug: slug,
  due,
  stability,
  stabilityFast: 1,
  difficulty: 5,
  reps: 2,
  lapses: 0,
  state: "review",
  lastReview: local(1),
});
const review = (slug: string, due: string, over: Partial<ReviewSource> = {}): ReviewSource => ({
  slug,
  card: card(slug, due),
  attempts: [makeAttempt({ problemSlug: slug, endedAt: local(1), rating: 3 })],
  patterns: [],
  ...over,
});
const candidate = (slug: string, patterns: string[] = []) => ({
  slug,
  title: slug,
  frontendId: "1",
  difficulty: "Easy" as const,
  patterns,
});
const input = (over: Partial<QueueInput> = {}): QueueInput => ({
  now: NOW,
  reviews: [],
  newCandidates: [],
  startedSlugs: new Set(),
  attempts: [],
  settings: { dailyNewLimit: 3, dailyReviewLimit: 20 },
  retrievabilityOf: () => 0.8,
  ...over,
});
const slugs = (q: { items: { slug: string }[] }) => q.items.map((i) => i.slug);

describe("buildQueue", () => {
  it("orders overdue (oldest first), then due today, then new; skips future reviews", () => {
    const q = buildQueue(
      input({
        reviews: [
          review("today", local(20, 8)),
          review("old", local(15)),
          review("older", local(10)),
          review("later-today", local(20, 22)),
          review("tomorrow", local(21)),
        ],
        newCandidates: [candidate("n1"), candidate("n2")],
      }),
    );
    expect(slugs(q)).toEqual(["older", "old", "today", "later-today", "n1", "n2"]);
    expect(q.items[0]).toMatchObject({ kind: "review", overdueDays: 10 });
    expect(q.items.at(-1)).toMatchObject({ kind: "new" });
    expect(q.reviewsDue).toBe(4);
  });

  it("over the review limit, keeps failed-last-time first, then the least remembered", () => {
    const failed = review("failed", local(19), {
      attempts: [makeAttempt({ problemSlug: "failed", endedAt: local(18), rating: 1 })],
    });
    const q = buildQueue(
      input({
        reviews: [review("strong", local(19)), review("weak", local(19)), failed],
        retrievabilityOf: (c) => (c.problemSlug === "weak" ? 0.3 : 0.9),
        settings: { dailyNewLimit: 0, dailyReviewLimit: 2 },
      }),
    );
    expect(slugs(q).sort()).toEqual(["failed", "weak"]);
    expect(q.items.find((i) => i.slug === "failed")?.failedLast).toBe(true);
    expect(q.reviewsDue).toBe(3);
  });

  it("counts today's work against the limits and never re-offers started problems", () => {
    const attempts = [
      { problemSlug: "done-new", endedAt: local(20, 8) }, // first attempt today: a new one
      { problemSlug: "done-review", endedAt: local(2) },
      { problemSlug: "done-review", endedAt: local(20, 9) }, // a review today
    ];
    const q = buildQueue(
      input({
        attempts,
        reviews: [review("r1", local(19)), review("r2", local(19))],
        newCandidates: [candidate("done-new"), candidate("a"), candidate("b"), candidate("c")],
        startedSlugs: new Set(["done-new", "done-review", "r1", "r2"]),
        settings: { dailyNewLimit: 2, dailyReviewLimit: 2 },
      }),
    );
    expect(q.newDoneToday).toBe(1);
    expect(q.reviewsDoneToday).toBe(1);
    expect(q.items.filter((i) => i.kind === "review")).toHaveLength(1);
    expect(q.items.filter((i) => i.kind === "new").map((i) => i.slug)).toEqual(["a"]);
  });

  it("interleaves so no more than two in a row share a pattern", () => {
    const q = buildQueue(
      input({
        newCandidates: [
          candidate("a1", ["arrays"]),
          candidate("a2", ["arrays"]),
          candidate("a3", ["arrays"]),
          candidate("t1", ["trees"]),
        ],
        settings: { dailyNewLimit: 4, dailyReviewLimit: 20 },
      }),
    );
    expect(slugs(q)).toEqual(["a1", "a2", "t1", "a3"]);
  });
});

describe("interleave", () => {
  it("keeps order when it can't avoid a run", () => {
    const xs = ["a", "b", "c"].map((slug) => ({ slug, patterns: ["p"] }));
    expect(interleave(xs).map((x) => x.slug)).toEqual(["a", "b", "c"]);
  });
  it("carries the run across from the previous section", () => {
    const tail = [{ patterns: ["p"] }, { patterns: ["p"] }];
    const xs = [{ patterns: ["p"] }, { patterns: ["q"] }];
    expect(interleave(xs, 2, tail)[0]!.patterns[0]).toBe("q");
  });
});

describe("leeches and quick reviews", () => {
  it("flags a problem rated Again three times", () => {
    expect(isLeech([{ rating: 1 }, { rating: 1 }, { rating: 3 }])).toBe(false);
    expect(isLeech([{ rating: 1 }, { rating: 1 }, { rating: 1 }])).toBe(true);
  });
  it("offers quick review only for mature, independently solved problems", () => {
    const solved = [{ outcome: "solved_independently" as const, kind: "full" as const }];
    expect(quickReviewEligible({ stability: 30 }, solved)).toBe(true);
    expect(quickReviewEligible({ stability: 10 }, solved)).toBe(false);
    expect(
      quickReviewEligible({ stability: 30 }, [{ outcome: "solved_with_help", kind: "full" }]),
    ).toBe(false);
    expect(quickReviewEligible(undefined, solved)).toBe(false);
  });
});
