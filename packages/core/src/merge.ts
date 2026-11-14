import type { Attempt, Problem, Settings } from "./types";

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

/**
 * Problems merge by slug with record-level LWW. (Per-field timestamps arrive with sync in M4.)
 */
export function mergeProblems(local: readonly Problem[], incoming: readonly Problem[]): Problem[] {
  const bySlug = new Map<string, Problem>();
  for (const p of local) bySlug.set(p.slug, p);
  for (const p of incoming) bySlug.set(p.slug, lww(bySlug.get(p.slug), p));
  return [...bySlug.values()];
}

export function mergeSettings(local: Settings, incoming: Settings): Settings {
  return lww(local, incoming);
}
