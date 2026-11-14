import { openDB, type DBSchema, type IDBPDatabase } from "idb";
import type { Attempt, Problem, Settings } from "@leettrack/core";
import { browser } from "wxt/browser";
import type { Repo, SessionStore } from "./repo";
import type { AttemptSession } from "./types";

interface LeetTrackDB extends DBSchema {
  problems: { key: string; value: Problem };
  attempts: { key: string; value: Attempt; indexes: { problemSlug: string } };
  kv: { key: string; value: unknown };
}

let dbPromise: Promise<IDBPDatabase<LeetTrackDB>> | undefined;

function db() {
  dbPromise ??= openDB<LeetTrackDB>("leettrack", 1, {
    upgrade(d) {
      d.createObjectStore("problems", { keyPath: "slug" });
      const attempts = d.createObjectStore("attempts", { keyPath: "id" });
      attempts.createIndex("problemSlug", "problemSlug");
      d.createObjectStore("kv");
    },
  });
  return dbPromise;
}

export const idbRepo: Repo = {
  async getProblem(slug) {
    return (await db()).get("problems", slug);
  },
  async allProblems() {
    return (await db()).getAll("problems");
  },
  async putProblems(problems) {
    const tx = (await db()).transaction("problems", "readwrite");
    await Promise.all([...problems.map((p) => tx.store.put(p)), tx.done]);
  },
  async attemptsFor(slug) {
    return (await db()).getAllFromIndex("attempts", "problemSlug", slug);
  },
  async allAttempts() {
    return (await db()).getAll("attempts");
  },
  async putAttempts(attempts) {
    const tx = (await db()).transaction("attempts", "readwrite");
    await Promise.all([...attempts.map((a) => tx.store.put(a)), tx.done]);
  },
  async getSettings() {
    return (await (await db()).get("kv", "settings")) as Settings | undefined;
  },
  async putSettings(settings) {
    await (await db()).put("kv", settings, "settings");
  },
};

/** In-progress sessions live in chrome.storage.session: they survive reloads, not browser restarts. */
export const chromeSessionStore: SessionStore = {
  async get(slug) {
    const key = `session:${slug}`;
    const value = (await browser.storage.session.get(key))[key];
    return (value as AttemptSession | undefined) ?? null;
  },
  async put(session) {
    await browser.storage.session.set({ [`session:${session.slug}`]: session });
  },
  async remove(slug) {
    await browser.storage.session.remove(`session:${slug}`);
  },
};
