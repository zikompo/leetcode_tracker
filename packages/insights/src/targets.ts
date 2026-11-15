import {
  buildPlan,
  dateKey,
  daysUntil,
  deadlineReview,
  fromDateKey,
  groupByPattern,
  addDays,
  paceOf,
  retrievability,
  upcomingTargets,
  type CardState,
  type DeadlineReview,
  type Difficulty,
  type Pace,
  type Plan,
  type TargetDate,
} from "@leettrack/core";
import { allLists, listSlugs, type Snapshot } from "./snapshot";

/** Interview date mode (spec 5.5): what's left before each interview, the plan and the pace. */

export interface PlanItem {
  slug: string;
  title: string;
  frontendId: string;
  difficulty: Difficulty;
  /** Suggested patterns; the first one groups the plan. */
  patterns: string[];
}

export interface TargetView {
  target: TargetDate;
  daysLeft: number;
  /** The lists it covers (the active lists when the target names none). */
  lists: { id: string; name: string }[];
  total: number;
  started: number;
  plan: Plan<PlanItem>;
  pace: Pace;
  /** Problems brought forward for an extra review before this interview. */
  extraReviews: number;
  /** The first day with no new problems, YYYY-MM-DD. */
  newStopsOn: string;
}

export const targetListIds = (snap: Snapshot, t: TargetDate) =>
  t.listIds.length ? t.listIds : snap.settings.activeLists;

const startedSlugs = (snap: Snapshot) =>
  new Set([
    ...snap.bySlug.keys(),
    ...snap.problems.filter((p) => p.statusOverride).map((p) => p.slug),
  ]);

/** When a problem was first started (first attempt, or a manual status), or null. */
function startedAt(snap: Snapshot, slug: string): string | null {
  const first = snap.bySlug.get(slug)?.[0];
  return first?.startedAt ?? snap.problemMap.get(slug)?.statusOverride?.at ?? null;
}

const targetSlugs = (snap: Snapshot, t: TargetDate) => [
  ...new Set(targetListIds(snap, t).flatMap((id) => listSlugs(snap, id))),
];

/** The target's unstarted problems in study order: one pattern at a time, list order within. */
export function targetRemaining(snap: Snapshot, t: TargetDate): PlanItem[] {
  const started = startedSlugs(snap);
  return groupByPattern(
    targetSlugs(snap, t)
      .filter((slug) => !started.has(slug))
      .map((slug) => {
        const info = snap.info(slug);
        return {
          slug,
          title: info.title ?? slug,
          frontendId: info.frontendId ?? "",
          difficulty: info.difficulty ?? "Medium",
          patterns: snap.patternsOf(slug).suggestedPatterns,
        };
      }),
  );
}

/** The extra review a card gets before an upcoming interview, if it needs one. */
export function deadlineReviewOf(snap: Snapshot, card: CardState): DeadlineReview | undefined {
  return deadlineReview(card, snap.settings.targetDates, snap.now, {
    bufferDays: snap.settings.targetBufferDays,
    minRecall: Math.max(snap.settings.desiredRetention, snap.settings.targetRetention),
    retrievabilityAt: (at) => retrievability(card, at, snap.scheduler),
  });
}

/** Each card's due date with interview extras applied. */
export function effectiveDue(snap: Snapshot): Map<string, DeadlineReview | { due: string }> {
  const out = new Map<string, DeadlineReview | { due: string }>();
  for (const [slug, card] of snap.cards) out.set(slug, deadlineReviewOf(snap, card) ?? card);
  return out;
}

function newDoneToday(snap: Snapshot): number {
  const today = dateKey(snap.now);
  let n = 0;
  for (const attempts of snap.bySlug.values()) {
    if (attempts[0] && dateKey(new Date(attempts[0].endedAt)) === today) n += 1;
  }
  return n;
}

/** Upcoming interviews, soonest first, with their plan and pace. */
export function targetsFrom(snap: Snapshot): TargetView[] {
  const targets = upcomingTargets(snap.settings.targetDates, snap.now);
  if (targets.length === 0) return [];
  const names = new Map(allLists(snap).map((l) => [l.id, l.name]));
  const due = effectiveDue(snap);
  const today = dateKey(snap.now);
  const reviewsByDay = new Map<string, number>();
  for (const d of due.values()) {
    const day = dateKey(new Date(d.due)) < today ? today : dateKey(new Date(d.due));
    reviewsByDay.set(day, (reviewsByDay.get(day) ?? 0) + 1);
  }
  const doneToday = newDoneToday(snap);
  const noNewDays = snap.settings.targetNoNewDays;

  // Earlier interviews plan first; later ones get what's left of each day, skip problems already
  // planned, and get no new problems on any interview's reviews-only days (as the queue does).
  const taken = new Map<string, number>();
  const planned = new Set<string>();
  const quietOn = (date: string) =>
    targets.find((t) => {
      const left = daysUntil(t.date, fromDateKey(date));
      return left >= 0 && left <= noNewDays;
    })?.label;

  return targets.map((target) => {
    const slugs = targetSlugs(snap, target);
    const remaining = targetRemaining(snap, target);
    const created = target.createdAt ? new Date(target.createdAt) : snap.now;
    const plan = buildPlan({
      now: snap.now,
      target: target.date,
      remaining: remaining.filter((p) => !planned.has(p.slug)),
      dailyNewLimit: snap.settings.dailyNewLimit,
      noNewDays,
      newDoneToday: doneToday,
      reviewsOn: (date) => reviewsByDay.get(date) ?? 0,
      takenOn: (date) => taken.get(date) ?? 0,
      quietOn,
    });
    for (const day of plan.days) {
      taken.set(day.date, (taken.get(day.date) ?? 0) + day.problems.length);
      for (const p of day.problems) planned.add(p.slug);
    }
    return {
      target,
      daysLeft: daysUntil(target.date, snap.now),
      lists: targetListIds(snap, target).flatMap((id) =>
        names.has(id) ? [{ id, name: names.get(id)! }] : [],
      ),
      total: slugs.length,
      started: slugs.length - remaining.length,
      plan,
      pace: paceOf({
        now: snap.now,
        start: created,
        target: target.date,
        noNewDays,
        startedAt: slugs.map((slug) => startedAt(snap, slug)),
      }),
      extraReviews: [...due.values()].filter((d) => "target" in d && d.target.id === target.id)
        .length,
      newStopsOn: dateKey(addDays(fromDateKey(target.date), -noNewDays)),
    };
  });
}

export interface Countdown {
  id: string;
  label: string;
  date: string;
  daysLeft: number;
}

/** Upcoming interviews for the dashboard and popup. */
export function countdowns(snap: Pick<Snapshot, "settings" | "now">): Countdown[] {
  return upcomingTargets(snap.settings.targetDates, snap.now).map((t) => ({
    id: t.id,
    label: t.label,
    date: t.date,
    daysLeft: daysUntil(t.date, snap.now),
  }));
}
