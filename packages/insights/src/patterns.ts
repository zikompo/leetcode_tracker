import { resolvePatternId, type Settings } from "@leettrack/core";
import { PATTERNS, PATTERN_BY_ID, type Pattern } from "@leettrack/seed";

/** The parts of settings that shape the taxonomy. */
export type PatternPrefs = Pick<Settings, "customPatterns" | "patternRenames" | "patternMerges">;

/** Built-in taxonomy (with the user's renames) then their own tags, minus merged-away ones. */
export function allPatterns(prefs: Partial<PatternPrefs> = {}): Pattern[] {
  const merged = prefs.patternMerges ?? {};
  const renames = prefs.patternRenames ?? {};
  return [
    ...PATTERNS.map((p) => ({ id: p.id, name: renames[p.id] ?? p.name })),
    ...(prefs.customPatterns ?? []).filter((c) => !PATTERN_BY_ID.has(c.id)),
  ].filter((p) => !merged[p.id]);
}

export function patternName(id: string, prefs: Partial<PatternPrefs> = {}): string {
  const live = resolvePatternId(id, prefs.patternMerges);
  return (
    prefs.patternRenames?.[live] ??
    PATTERN_BY_ID.get(live)?.name ??
    prefs.customPatterns?.find((c) => c.id === live)?.name ??
    live
  );
}

/** Suggested ids mapped through merges, without duplicates. */
export function resolvedSuggestions(ids: readonly string[], prefs: Partial<PatternPrefs> = {}) {
  return [...new Set(ids.map((id) => resolvePatternId(id, prefs.patternMerges)))];
}
