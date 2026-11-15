import { describe, expect, it } from "vitest";
import { mergeSessions } from "./session";
import type { AttemptSession } from "./types";

const base = (over: Partial<AttemptSession> = {}): AttemptSession => ({
  slug: "two-sum",
  startedAt: "2026-11-14T10:00:00.000Z",
  lastActiveAt: "2026-11-14T10:05:00.000Z",
  activeSeconds: 300,
  submissions: [],
  submissionIds: [],
  viewedSolutionDetected: false,
  ...over,
});

describe("mergeSessions", () => {
  it("keeps whichever exists", () => {
    const s = base();
    expect(mergeSessions(s, null)).toBe(s);
    expect(mergeSessions(null, s)).toBe(s);
    expect(mergeSessions(null, null)).toBeNull();
  });
  it("keeps a submission that arrived while the stored session loaded", () => {
    const stored = base({
      submissionIds: ["1"],
      submissions: [{ at: "a", status: "Wrong Answer" }],
    });
    const live = base({
      startedAt: "2026-11-14T10:06:00.000Z",
      lastActiveAt: "2026-11-14T10:06:02.000Z",
      activeSeconds: 2,
      submissionIds: ["2"],
      submissions: [{ at: "b", status: "Accepted" }],
      stoppedAt: "2026-11-14T10:06:02.000Z",
      checkpoints: [{ at: "b", activeSeconds: 2 }],
      code: "class Solution: ...",
    });
    const merged = mergeSessions(stored, live)!;
    expect(merged.startedAt).toBe(stored.startedAt);
    expect(merged.activeSeconds).toBe(302);
    expect(merged.submissionIds).toEqual(["1", "2"]);
    expect(merged.submissions.map((s) => s.status)).toEqual(["Wrong Answer", "Accepted"]);
    expect(merged.checkpoints).toEqual([{ at: "b", activeSeconds: 302 }]);
    expect(merged).toMatchObject({ stoppedAt: live.stoppedAt, code: "class Solution: ..." });
  });
  it("doesn't double a session that was saved and read back", () => {
    const live = base({ submissionIds: ["1"], submissions: [{ at: "a", status: "Accepted" }] });
    const stored = { ...live, activeSeconds: live.activeSeconds - 1 };
    expect(mergeSessions(stored, live)).toBe(live);
  });
});
