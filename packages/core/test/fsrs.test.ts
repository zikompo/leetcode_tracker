import { describe, expect, it } from "vitest";
import { getScheduler, replayCard, retrievability } from "../src";

const at = (iso: string, rating: 1 | 2 | 3 | 4) => ({ endedAt: iso, createdAt: iso, rating });
const days = (from: string, to: string) => (Date.parse(to) - Date.parse(from)) / 86_400_000;

describe("replayCard", () => {
  it("has no card without attempts", () => {
    expect(replayCard("x", [])).toBeUndefined();
  });
  it("brings a failed problem back the next day, never sooner", () => {
    const t = "2026-03-01T10:00:00.000Z";
    const card = replayCard("x", [at(t, 1)])!;
    expect(days(t, card.due)).toBe(1);
    expect(card.lapses + card.reps).toBeGreaterThan(0);
  });
  it("schedules whole days, with intervals growing on Good", () => {
    const t1 = "2026-03-01T10:00:00.000Z";
    const first = replayCard("x", [at(t1, 3)])!;
    const gap1 = days(t1, first.due);
    expect(Number.isInteger(gap1)).toBe(true);
    expect(gap1).toBeGreaterThanOrEqual(2);
    const second = replayCard("x", [at(t1, 3), at(first.due, 3)])!;
    expect(days(first.due, second.due)).toBeGreaterThan(gap1);
    expect(second.state).toBe("review");
    expect(second.lastReview).toBe(first.due);
  });
  it("replays in time order regardless of input order", () => {
    const a = at("2026-03-01T10:00:00.000Z", 3);
    const b = at("2026-03-06T10:00:00.000Z", 1);
    expect(replayCard("x", [b, a])).toEqual(replayCard("x", [a, b]));
  });
  it("schedules sooner when the target retention is higher", () => {
    const history = [at("2026-03-01T10:00:00.000Z", 3), at("2026-03-06T10:00:00.000Z", 3)];
    const relaxed = replayCard("x", history, getScheduler(0.8))!;
    const strict = replayCard("x", history, getScheduler(0.95))!;
    expect(Date.parse(strict.due)).toBeLessThan(Date.parse(relaxed.due));
  });
});

describe("retrievability", () => {
  it("starts near 1 and decays", () => {
    const t = "2026-03-01T10:00:00.000Z";
    const card = replayCard("x", [at(t, 3)])!;
    const r0 = retrievability(card, new Date(t));
    const r10 = retrievability(card, new Date("2026-03-11T10:00:00.000Z"));
    expect(r0).toBeGreaterThan(0.95);
    expect(r10).toBeLessThan(r0);
    expect(r10).toBeGreaterThan(0);
  });
});
