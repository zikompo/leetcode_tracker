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
