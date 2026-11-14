import { describe, expect, it } from "vitest";
import { deriveStatus } from "../src";
import { makeAttempt, makeProblem } from "./fixtures";

describe("deriveStatus", () => {
  it("is unseen with no attempts", () => {
    expect(deriveStatus(makeProblem(), [])).toEqual({ status: "unseen", overridden: false });
  });

  it("is in_progress when never solved", () => {
    const s = deriveStatus(makeProblem(), [
      makeAttempt({ outcome: "not_solved", optimality: undefined }),
    ]);
    expect(s.status).toBe("in_progress");
  });

  it("is solved_with_help when best is with help", () => {
    const s = deriveStatus(undefined, [
      makeAttempt({ outcome: "not_solved" }),
      makeAttempt({ outcome: "solved_with_help", helpLevel: "hint" }),
    ]);
    expect(s.status).toBe("solved_with_help");
  });

  it("takes optimality from the most recent independent solve", () => {
    const s = deriveStatus(undefined, [
      makeAttempt({
        outcome: "solved_independently",
        optimality: "optimal",
        endedAt: "2026-01-01",
      }),
      makeAttempt({
        outcome: "solved_independently",
        optimality: "suboptimal",
        endedAt: "2026-02-01",
      }),
      makeAttempt({ outcome: "not_solved", endedAt: "2026-03-01" }),
    ]);
    expect(s).toEqual({ status: "fully_solved", optimality: "suboptimal", overridden: false });
  });

  it("is mastered only when optimal and stability exceeds the threshold", () => {
    const attempts = [makeAttempt({ optimality: "optimal" })];
    expect(deriveStatus(undefined, attempts).status).toBe("fully_solved");
    expect(deriveStatus(undefined, attempts, 10).status).toBe("fully_solved");
    expect(deriveStatus(undefined, attempts, 31).status).toBe("mastered");
    expect(deriveStatus(undefined, [makeAttempt({ optimality: "suboptimal" })], 90).status).toBe(
      "fully_solved",
    );
  });

  it("honors a manual override", () => {
    const p = makeProblem({
      statusOverride: { status: "fully_solved", optimality: "optimal", at: "x" },
    });
    expect(deriveStatus(p, [])).toEqual({
      status: "fully_solved",
      optimality: "optimal",
      overridden: true,
    });
  });
});

describe("quick reviews and status", () => {
  it("keep optimality from the latest full solve", () => {
    const full = makeAttempt({ optimality: "optimal" });
    const quick = makeAttempt({ kind: "quick", endedAt: "2027-01-01T00:00:00.000Z" });
    delete (quick as { optimality?: string }).optimality;
    expect(deriveStatus(undefined, [full, quick])).toMatchObject({
      status: "fully_solved",
      optimality: "optimal",
    });
  });
});
