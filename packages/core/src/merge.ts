import type { Attempt, CustomList, MockInterview, Problem, Settings } from "./types";

interface Versioned {
  updatedAt: string;
}

/** Last-write-wins between two versions of the same record (ties keep `current`). */
export function lww<T extends Versioned>(current: T | undefined, incoming: T): T {
  if (!current) return incoming;
  return incoming.updatedAt > current.updatedAt ? incoming : current;
}

/**
 * Attempts are append-only with client UUIDs, so merging is a union by id;
 * edits to the same attempt resolve by `updatedAt` (spec 9.3).
 */
export function mergeAttempts(local: readonly Attempt[], incoming: readonly Attempt[]): Attempt[] {
  const byId = new Map<string, Attempt>();
  for (const a of local) byId.set(a.id, a);
  for (const a of incoming) byId.set(a.id, lww(byId.get(a.id), a));
  return [...byId.values()].sort((a, b) => a.startedAt.localeCompare(b.startedAt));
}

/** Problems merge by slug with record-level last-write-wins. */
export function mergeProblems(local: readonly Problem[], incoming: readonly Problem[]): Problem[] {
  const bySlug = new Map<string, Problem>();
  for (const p of local) bySlug.set(p.slug, p);
  for (const p of incoming) bySlug.set(p.slug, lww(bySlug.get(p.slug), p));
  return [...bySlug.values()];
}

/** Custom lists merge by id, last write wins; a delete is a newer tombstone. */
export function mergeCustomLists(
  local: readonly CustomList[],
  incoming: readonly CustomList[],
): CustomList[] {
  const byId = new Map<string, CustomList>();
  for (const l of local) byId.set(l.id, l);
  for (const l of incoming) byId.set(l.id, lww(byId.get(l.id), l));
  return [...byId.values()];
}

export function mergeSettings(local: Settings, incoming: Settings): Settings {
  return lww(local, incoming);
}

/** Mock interviews merge like custom lists: by id, last write wins, deletes are tombstones. */
export function mergeMocks(
  local: readonly MockInterview[],
  incoming: readonly MockInterview[],
): MockInterview[] {
  const byId = new Map<string, MockInterview>();
  for (const m of local) byId.set(m.id, m);
  for (const m of incoming) byId.set(m.id, lww(byId.get(m.id), m));
  return [...byId.values()];
}
