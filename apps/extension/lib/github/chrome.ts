import { browser } from "wxt/browser";
import { createGitHubApi } from "./api";
import type { GitHubStore } from "./service";

const env = import.meta.env as unknown as Record<string, string | undefined>;

/** Set at build time from apps/extension/.env.local (see docs/github-setup.md). */
export const GITHUB_ENV = {
  clientId: env.WXT_GITHUB_CLIENT_ID ?? "",
  appSlug: env.WXT_GITHUB_APP_SLUG ?? "",
  web: (env.WXT_GITHUB_WEB_URL || "https://github.com").replace(/\/+$/, ""),
  api: (env.WXT_GITHUB_API_URL || "https://api.github.com").replace(/\/+$/, ""),
};

/**
 * Host access to ask for when connecting. github.com's sign-in endpoints don't allow calls
 * from other sites, so the extension needs permission for them; a local stand-in server
 * (plain http, used in tests) allows such calls itself and needs none.
 */
export const GITHUB_ORIGINS = [GITHUB_ENV.web, GITHUB_ENV.api]
  .filter((u) => u.startsWith("https://"))
  .map((u) => `${new URL(u).origin}/*`);

export const githubApi = () =>
  GITHUB_ENV.clientId
    ? createGitHubApi({
        clientId: GITHUB_ENV.clientId,
        endpoints: { web: GITHUB_ENV.web, api: GITHUB_ENV.api },
      })
    : null;

const local = browser.storage.local;
const key = (k: string) => `leettrack:github:${k}`;
async function read<T>(k: string, fallback: T): Promise<T> {
  return ((await local.get(key(k)))[key(k)] as T | undefined) ?? fallback;
}
const write = (k: string, v: unknown) =>
  v === null ? local.remove(key(k)) : local.set({ [key(k)]: v });

/** The GitHub token, pending sign-in and commit queue: this browser only, never synced. */
export const chromeGitHubStore: GitHubStore = {
  getToken: () => read("token", null),
  setToken: (t) => write("token", t),
  getPending: () => read("pending", null),
  setPending: (p) => write("pending", p),
  getQueue: () => read("queue", []),
  setQueue: (q) => write("queue", q),
  getDone: () => read("done", []),
  setDone: (d) => write("done", d),
  getState: () => read("state", {}),
  setState: (s) => write("state", s),
};
