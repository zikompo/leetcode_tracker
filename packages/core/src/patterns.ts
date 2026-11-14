import type { CustomPattern } from "./types";

/** Stable id for a tag name: "Two Pointers!" → "two-pointers". */
export function tagId(name: string): string {
  return name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Follow merges ("sliding-window-fixed" merged into "sliding-window-variable") to the live id. */
export function resolvePatternId(
  id: string,
  merges: Readonly<Record<string, string>> = {},
): string {
  const seen = new Set<string>();
  let cur = id;
  while (merges[cur] && !seen.has(cur)) {
    seen.add(cur);
    cur = merges[cur]!;
  }
  return cur;
}

/** Resolve and de-duplicate a list of pattern ids. */
export const resolvePatternIds = (
  ids: readonly string[],
  merges?: Readonly<Record<string, string>>,
) => [...new Set(ids.map((id) => resolvePatternId(id, merges)))];

/** Add a custom tag unless one with the same id already exists among `known` ids. */
export function addCustomPattern(
  existing: readonly CustomPattern[],
  name: string,
  knownIds: ReadonlySet<string>,
): { patterns: CustomPattern[]; id: string } {
  const clean = name.trim().replace(/\s+/g, " ");
  const id = tagId(clean);
  if (!id) throw new Error("Tag name needs at least one letter or digit.");
  if (knownIds.has(id) || existing.some((p) => p.id === id)) return { patterns: [...existing], id };
  return { patterns: [...existing, { id, name: clean }], id };
}
