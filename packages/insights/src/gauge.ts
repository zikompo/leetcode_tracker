import type { Rating } from "@leettrack/core";
import type { Snapshot } from "./snapshot";
import { queueFrom } from "./views";

/** The dashboard's confidence gauge: today's work, and how sure you were last time. */

export interface GaugeBand {
  rating: Rating;
  label: "Again" | "Hard" | "Good" | "Easy";
  /** Problems whose latest attempt got this rating. */
  count: number;
  /** Of those, reviews in today's queue. */
  dueToday: number;
}

export interface ConfidenceGauge {
  /** Reviews plus new problems in today's queue. */
  toDo: number;
  reviewsToday: number;
  newToday: number;
  /** Problems with at least one attempt. */
  tracked: number;
  /** Again, Hard, Good, Easy. */
  bands: GaugeBand[];
}

const LABELS = { 1: "Again", 2: "Hard", 3: "Good", 4: "Easy" } as const;

export function confidenceGauge(snap: Snapshot): ConfidenceGauge {
  const queue = queueFrom(snap);
  const due = new Set(queue.items.filter((i) => i.kind === "review").map((i) => i.slug));
  const bands: GaugeBand[] = ([1, 2, 3, 4] as const).map((rating) => ({
    rating,
    label: LABELS[rating],
    count: 0,
    dueToday: 0,
  }));
  for (const [slug, attempts] of snap.bySlug) {
    const last = attempts.at(-1); // bySlug is oldest first
    if (!last) continue;
    const band = bands[last.rating - 1]!;
    band.count += 1;
    if (due.has(slug)) band.dueToday += 1;
  }
  const reviewsToday = due.size;
  const newToday = queue.items.length - reviewsToday;
  return {
    toDo: queue.items.length,
    reviewsToday,
    newToday,
    tracked: snap.bySlug.size,
    bands,
  };
}
