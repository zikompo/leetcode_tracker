import {
  addDays,
  dateKey,
  fromDateKey,
  suggestRating,
  type Attempt,
  type HelpLevel,
  type MockInterview,
  type Outcome,
  type Problem,
  type Rating,
  type TargetDate,
} from "@leettrack/core";
import { SEED_BY_SLUG } from "@leettrack/seed";
import { z } from "zod";

/**
 * Import from the earlier prep tracker (spec 12.3): its `probs` (keyed by slug, with a status
 * of before | solved | help, the day it was counted, a redo stage and due date, and whether it
 * was redone cleanly), `mocks` and interview dates.
 */

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const trackerSchema = z.object({
  v: z.literal(1).optional(),
  interview: day.optional(),
  interview2: day.optional(),
  probs: z.record(
    z.string(),
    z.object({
      status: z.enum(["before", "solved", "help"]).optional(),
      countedOn: day.optional(),
      redo: z.object({ stage: z.number(), due: day }).nullable().optional(),
      clean: z.boolean().optional(),
    }),
  ),
  log: z.record(z.string(), z.unknown()).optional(),
  mocks: z.array(z.object({ id: z.string(), date: day, notes: z.string().optional() })).optional(),
  updatedAt: z.number().optional(),
});

/** Whether parsed JSON looks like a prep-tracker export rather than a LeetTrack one. */
export function isPrepTracker(raw: unknown): boolean {
  return (
    typeof raw === "object" &&
    raw !== null &&
    !("app" in raw) &&
    "probs" in raw &&
    typeof (raw as { probs: unknown }).probs === "object"
  );
}

export interface TrackerImport {
  /** Problems marked "Done before", as a manual status. */
  problems: Problem[];
  attempts: Attempt[];
  mocks: MockInterview[];
  /** Interview dates, to add to settings if they aren't there yet. */
  targetDates: TargetDate[];
}

const NOTE = "Imported from your prep tracker.";
const ESTIMATED = "Imported from your prep tracker; the date is estimated.";

/** Noon local time on a calendar day: far from midnight, so the day never shifts. */
const noon = (key: string) => {
  const d = fromDateKey(key);
  d.setHours(12);
  return d.toISOString();
};

function attemptOn(
  slug: string,
  id: string,
  key: string,
  a: {
    outcome: Outcome;
    helpLevel: HelpLevel;
    isCold: boolean;
    rating?: Rating;
    notes: string;
  },
): Attempt {
  const at = noon(key);
  const suggested =
    suggestRating({
      outcome: a.outcome,
      ...(a.helpLevel !== "none" ? { helpLevel: a.helpLevel } : {}),
    }) ?? 3;
  return {
    id,
    problemSlug: slug,
    startedAt: at,
    endedAt: at,
    // Unknown: zero keeps these out of the solve-time medians.
    activeSeconds: 0,
    isCold: a.isCold,
    kind: "full",
    outcome: a.outcome,
    helpLevel: a.helpLevel,
    viewedSolutionDetected: false,
    ...(a.outcome !== "not_solved" ? { optimality: "unsure" as const } : {}),
    suggestedRating: suggested,
    rating: a.rating ?? suggested,
    notes: a.notes,
    submissions: [],
    createdAt: at,
    updatedAt: at,
  };
}

/**
 * Map a tracker export to LeetTrack records. Ids are derived from the tracker's data, so
 * importing the same file again adds nothing.
 *
 * - before: a manual "fully solved" status, no attempt.
 * - solved: an independent attempt on the day it was counted. help: an attempt with help.
 * - Redos become review attempts so the schedule replays: the tracker's ladder is a first redo
 *   two days after needing help and a second five days after a clean one. `clean` means both
 *   were done cleanly; a pending second-stage redo means the first was. A first-stage redo due
 *   later than two days after the problem means a redo went badly, so that one is recorded
 *   as Again. Redo dates aren't stored by the tracker, so they're estimated from the ladder.
 */
export function fromPrepTracker(raw: unknown, now: Date = new Date()): TrackerImport {
  const parsed = trackerSchema.safeParse(raw);
  if (!parsed.success) throw new Error("This doesn't look like a prep tracker export.");
  const t = parsed.data;
  const exportedOn = dateKey(t.updatedAt ? new Date(t.updatedAt) : now);
  const atMost = (key: string) => (key > exportedOn ? exportedOn : key);
  const stamp = (t.updatedAt ? new Date(t.updatedAt) : now).toISOString();

  const problems: Problem[] = [];
  const attempts: Attempt[] = [];
  for (const [slug, p] of Object.entries(t.probs)) {
    if (!p.status) continue;
    if (p.status === "before" || !p.countedOn) {
      const seed = SEED_BY_SLUG.get(slug);
      problems.push({
        slug,
        frontendId: seed?.frontendId ?? "",
        title: seed?.title ?? slug,
        difficulty: seed?.difficulty ?? "Medium",
        url: `https://leetcode.com/problems/${slug}/`,
        leetcodeTopics: [],
        patterns: [],
        suggestedPatterns: seed?.suggestedPatterns ?? [],
        lists: seed?.lists ?? [],
        statusOverride: { status: "fully_solved", at: stamp },
        updatedAt: stamp,
      });
      continue;
    }
    const help = p.status === "help";
    attempts.push(
      attemptOn(slug, `tracker-${slug}-1`, p.countedOn, {
        outcome: help ? "solved_with_help" : "solved_independently",
        helpLevel: help ? "approach" : "none",
        isCold: true,
        notes: NOTE,
      }),
    );
    const clean = (id: string, key: string) =>
      attempts.push(
        attemptOn(slug, id, atMost(key), {
          outcome: "solved_independently",
          helpLevel: "none",
          isCold: false,
          notes: `Clean redo. ${ESTIMATED}`,
        }),
      );
    const firstRedo = dateKey(addDays(fromDateKey(p.countedOn), 2));
    if (p.clean) {
      clean(`tracker-${slug}-r1`, firstRedo);
      clean(`tracker-${slug}-r2`, dateKey(addDays(fromDateKey(firstRedo), 5)));
    } else if (p.redo?.stage === 2) {
      clean(`tracker-${slug}-r1`, dateKey(addDays(fromDateKey(p.redo.due), -5)));
    } else if (p.redo && p.redo.due > firstRedo) {
      attempts.push(
        attemptOn(
          slug,
          `tracker-${slug}-r1`,
          atMost(dateKey(addDays(fromDateKey(p.redo.due), -2))),
          {
            outcome: "solved_with_help",
            helpLevel: "approach",
            isCold: false,
            rating: 1,
            notes: `Struggled on the redo. ${ESTIMATED}`,
          },
        ),
      );
    }
  }

  const mocks: MockInterview[] = (t.mocks ?? []).map((m) => ({
    id: `tracker-${m.id}`,
    date: m.date,
    notes: m.notes ?? "",
    updatedAt: stamp,
  }));

  const dates = [...new Set([t.interview, t.interview2].filter((d): d is string => !!d))].sort();
  const targetDates: TargetDate[] = dates.map((date, i) => ({
    id: `tracker-${date}`,
    label: dates.length > 1 ? `Interview ${i + 1}` : "Interview",
    date,
    listIds: [],
    createdAt: noon(dateKey(addDays(fromDateKey(date), -21))),
  }));

  return { problems, attempts, mocks, targetDates };
}

/** Add imported interview dates that aren't there yet (same date counts as there). */
export function withTargetDates(
  existing: readonly TargetDate[] | undefined,
  incoming: readonly TargetDate[],
): TargetDate[] | undefined {
  const have = new Set((existing ?? []).map((t) => t.date));
  const added = incoming.filter((t) => !have.has(t.date));
  return added.length ? [...(existing ?? []), ...added] : undefined;
}
