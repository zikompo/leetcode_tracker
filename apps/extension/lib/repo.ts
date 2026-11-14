import type { Attempt, Problem, Settings } from "@leettrack/core";
import type { AttemptSession } from "./types";

/** Persistence used by the background service. IndexedDB in production, in-memory in tests. */
export interface Repo {
  getProblem(slug: string): Promise<Problem | undefined>;
  allProblems(): Promise<Problem[]>;
  putProblems(problems: Problem[]): Promise<void>;
  attemptsFor(slug: string): Promise<Attempt[]>;
  allAttempts(): Promise<Attempt[]>;
  putAttempts(attempts: Attempt[]): Promise<void>;
  getSettings(): Promise<Settings | undefined>;
  putSettings(settings: Settings): Promise<void>;
}

export interface SessionStore {
  get(slug: string): Promise<AttemptSession | null>;
  put(session: AttemptSession): Promise<void>;
  remove(slug: string): Promise<void>;
}

export function memoryRepo(): Repo {
  const problems = new Map<string, Problem>();
  const attempts = new Map<string, Attempt>();
  let settings: Settings | undefined;
  return {
    getProblem: async (slug) => problems.get(slug),
    allProblems: async () => [...problems.values()],
    putProblems: async (ps) => ps.forEach((p) => problems.set(p.slug, p)),
    attemptsFor: async (slug) => [...attempts.values()].filter((a) => a.problemSlug === slug),
    allAttempts: async () => [...attempts.values()],
    putAttempts: async (as) => as.forEach((a) => attempts.set(a.id, a)),
    getSettings: async () => settings,
    putSettings: async (s) => {
      settings = s;
    },
  };
}

export function memorySessionStore(): SessionStore {
  const sessions = new Map<string, AttemptSession>();
  return {
    get: async (slug) => sessions.get(slug) ?? null,
    put: async (s) => void sessions.set(s.slug, s),
    remove: async (slug) => void sessions.delete(slug),
  };
}
