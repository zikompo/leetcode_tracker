import type { HelpLevel } from "./types";

/**
 * The timebox (spec 5.5, desirable difficulty): when an attempt runs past it without an
 * Accepted, the panel nudges one rung up the hint ladder at a time instead of straight to the
 * solution.
 */

export interface HintRung {
  level: Exclude<HelpLevel, "none">;
  title: string;
  body: string;
}

export const HINT_LADDER: readonly HintRung[] = [
  {
    level: "hint",
    title: "Try one hint",
    body: "Open LeetCode's Hints or the topic tags, take just one, and keep going.",
  },
  {
    level: "approach",
    title: "Read only the key idea",
    body: "Skim the Editorial for the approach, close it, and write the code yourself.",
  },
  {
    level: "partial_code",
    title: "Look at part of a solution",
    body: "Read the first few lines of a solution, then finish it on your own.",
  },
];

/** A new rung is offered this often after the timebox runs out. */
export const RUNG_EVERY_SECONDS = 5 * 60;

/** Which rung to offer now: -1 before the timebox ends (or with it turned off). */
export function timeboxRung(activeSeconds: number, timeboxMinutes: number): number {
  if (timeboxMinutes <= 0) return -1;
  const over = activeSeconds - timeboxMinutes * 60;
  if (over < 0) return -1;
  return Math.min(HINT_LADDER.length - 1, Math.floor(over / RUNG_EVERY_SECONDS));
}
