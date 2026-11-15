import { effectivePatterns, type Difficulty } from "@leettrack/core";
import { patternName } from "./patterns";
import type { Snapshot } from "./snapshot";

/** The Clue Journal (spec 7.1, page 8): what told you which pattern to use, by pattern. */

export interface ClueEntry {
  attemptId: string;
  slug: string;
  title: string;
  frontendId?: string;
  difficulty?: Difficulty;
  clue: string;
  /** When the attempt ended. */
  at: string;
}

export interface ClueGroup {
  /** "" for problems with no pattern yet. */
  patternId: string;
  name: string;
  entries: ClueEntry[];
}

/**
 * Every pattern clue, under each pattern its problem has (confirmed ones, else suggested),
 * newest first. Patterns are sorted by name; problems without one come last.
 */
export function clueJournal(snap: Snapshot): ClueGroup[] {
  const groups = new Map<string, ClueEntry[]>();
  for (const a of snap.attempts) {
    const clue = a.patternClue?.trim();
    if (!clue) continue;
    const info = snap.info(a.problemSlug);
    const entry: ClueEntry = {
      attemptId: a.id,
      slug: a.problemSlug,
      title: info.title ?? a.problemSlug,
      ...(info.frontendId ? { frontendId: info.frontendId } : {}),
      ...(info.difficulty ? { difficulty: info.difficulty } : {}),
      clue,
      at: a.endedAt,
    };
    const ids = [...effectivePatterns(snap.patternsOf(a.problemSlug))];
    for (const id of ids.length ? ids : [""]) groups.set(id, [...(groups.get(id) ?? []), entry]);
  }
  const prefs = snap.settings;
  return [...groups]
    .map(([patternId, entries]) => ({
      patternId,
      name: patternId ? patternName(patternId, prefs) : "No pattern yet",
      entries: entries.sort((a, b) => b.at.localeCompare(a.at)),
    }))
    .sort((a, b) => Number(!a.patternId) - Number(!b.patternId) || a.name.localeCompare(b.name));
}
