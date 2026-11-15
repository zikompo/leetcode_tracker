import { describe, expect, it } from "vitest";
import { daysUntil, formatDue } from "./format";

const now = new Date(2026, 10, 14, 15);
const day = (d: number, h = 9) => new Date(2026, 10, d, h).toISOString();

describe("formatDue", () => {
  it("counts local calendar days", () => {
    expect(daysUntil(day(14, 23), now)).toBe(0);
    expect(daysUntil(day(15, 1), now)).toBe(1);
    expect(daysUntil(day(11), now)).toBe(-3);
  });
  it("reads naturally", () => {
    expect(formatDue(day(14), now)).toBe("today");
    expect(formatDue(day(15), now)).toBe("tomorrow");
    expect(formatDue(day(13), now)).toBe("1 day overdue");
    expect(formatDue(day(18), now)).toMatch(/\(in 4 days\)$/);
  });
});

describe("formatAgo", () => {
  it("rounds to the nearest sensible unit", async () => {
    const { formatAgo } = await import("./format");
    const t = new Date("2026-11-14T12:00:00Z");
    expect(formatAgo("2026-11-14T11:59:30Z", t)).toBe("just now");
    expect(formatAgo("2026-11-14T11:55:00Z", t)).toBe("5 min ago");
    expect(formatAgo("2026-11-14T09:00:00Z", t)).toBe("3 h ago");
    expect(formatAgo("2026-11-12T12:00:00Z", t)).toBe("2 days ago");
  });
});
