import { describe, expect, it } from "vitest";
import { attemptSchema, customListSchema, problemSchema } from "@leettrack/core";
import { buildSnapshot, dashboardFrom, queueFrom } from "@leettrack/insights";
import { demoData } from "../lib/demo";
import { formatDue, parseProblemRef } from "../lib/util";

describe("parseProblemRef", () => {
  it("accepts LeetCode URLs and bare slugs", () => {
    expect(parseProblemRef("https://leetcode.com/problems/two-sum/description/")).toBe("two-sum");
    expect(parseProblemRef("  Two-Sum ")).toBe("two-sum");
    expect(parseProblemRef("leetcode.com/problems/3sum")).toBe("3sum");
    expect(parseProblemRef("not a slug!")).toBeNull();
    expect(parseProblemRef("https://example.com/x")).toBeNull();
  });
});

describe("formatDue", () => {
  it("reads naturally", () => {
    const now = new Date(2026, 10, 14, 12);
    expect(formatDue(new Date(2026, 10, 14, 20).toISOString(), now)).toBe("today");
    expect(formatDue(new Date(2026, 10, 18).toISOString(), now)).toBe("in 4 days");
    expect(formatDue(new Date(2026, 10, 11).toISOString(), now)).toBe("3 days overdue");
  });
});

describe("demo data", () => {
  const data = demoData(new Date(2026, 10, 14, 12));
  it("is valid app data", () => {
    for (const a of data.attempts) expect(attemptSchema.safeParse(a).success, a.id).toBe(true);
    for (const p of data.problems) expect(problemSchema.safeParse(p).success, p.slug).toBe(true);
    for (const l of data.customLists ?? [])
      expect(customListSchema.safeParse(l).success).toBe(true);
  });
  it("looks like a real account: reviews due, a leech, mixed outcomes", () => {
    const snap = buildSnapshot(data, new Date(2026, 10, 14, 12));
    expect(data.problems.length).toBeGreaterThan(30);
    expect(queueFrom(snap).items.some((i) => i.kind === "review")).toBe(true);
    const dash = dashboardFrom(snap);
    expect(dash.leeches.length).toBeGreaterThan(0);
    expect(new Set(data.attempts.map((a) => a.outcome)).size).toBe(3);
  });
  it("is the same every time", () => {
    expect(demoData(new Date(2026, 10, 14, 12))).toEqual(data);
  });
});
