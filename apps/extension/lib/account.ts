import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { browser } from "wxt/browser";
import { supabaseRemote } from "./remote";
import type { Repo } from "./repo";
import { createSync, type SyncState, type SyncStateStore } from "./sync";

const env = import.meta.env as unknown as Record<string, string | undefined>;

/** Set at build time from apps/extension/.env.local (see docs/supabase-setup.md). */
export const ACCOUNT_ENV = {
  supabaseUrl: env.WXT_SUPABASE_URL ?? "",
  supabaseKey: env.WXT_SUPABASE_ANON_KEY ?? "",
  websiteUrl: (env.WXT_WEBSITE_URL || "http://localhost:3000").replace(/\/+$/, ""),
};
export const ACCOUNT_CONFIGURED = Boolean(ACCOUNT_ENV.supabaseUrl && ACCOUNT_ENV.supabaseKey);

export interface SyncStatus {
  /** False when this build has no Supabase project configured. */
  configured: boolean;
  websiteUrl: string;
  signedIn: boolean;
  userName?: string;
  avatarUrl?: string;
  syncing: boolean;
  lastSyncAt?: string;
  lastError?: string;
}

const AUTH_KEY = "leettrack:auth";
const SYNC_KEY = "leettrack:sync";

/** The session and sync bookkeeping live in chrome.storage.local: this browser only. */
const local = browser.storage.local;
const authStorage = {
  getItem: async (key: string) => ((await local.get(key))[key] as string | undefined) ?? null,
  setItem: (key: string, value: string) => local.set({ [key]: value }),
  removeItem: (key: string) => local.remove(key),
};
const syncState: SyncStateStore = {
  get: async () => ((await local.get(SYNC_KEY))[SYNC_KEY] as SyncState | undefined) ?? {},
  set: (state) => local.set({ [SYNC_KEY]: state }),
};

/** Account and background sync for the service worker. */
export function createAccount(deps: { repo: Repo; onDataChanged(): void }) {
  let client: SupabaseClient | undefined;
  let running: Promise<void> | null = null;
  let timer: ReturnType<typeof setTimeout> | undefined;

  const supabase = () =>
    (client ??= createClient(ACCOUNT_ENV.supabaseUrl, ACCOUNT_ENV.supabaseKey, {
      auth: {
        storage: authStorage,
        storageKey: AUTH_KEY,
        persistSession: true,
        // The extension signs in on its own (PKCE through Chrome's sign-in window), so it has a
        // session of its own. Sharing the website's would break: refresh tokens are single-use,
        // and whichever side refreshed second would be signed out.
        flowType: "pkce",
        // Service workers sleep, so timers are unreliable: the session refreshes on use.
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    }));

  async function session() {
    if (!ACCOUNT_CONFIGURED) return null;
    const { data } = await supabase().auth.getSession();
    return data.session;
  }

  async function status(): Promise<SyncStatus> {
    const base: SyncStatus = {
      configured: ACCOUNT_CONFIGURED,
      websiteUrl: ACCOUNT_ENV.websiteUrl,
      signedIn: false,
      syncing: running !== null,
    };
    const s = await session().catch(() => null);
    if (!s) return base;
    const meta = s.user.user_metadata as Record<string, string | undefined>;
    const name = meta.user_name ?? meta.full_name ?? s.user.email;
    const state = await syncState.get();
    return {
      ...base,
      signedIn: true,
      ...(name ? { userName: name } : {}),
      ...(meta.avatar_url ? { avatarUrl: meta.avatar_url } : {}),
      ...(state.lastSyncAt ? { lastSyncAt: state.lastSyncAt } : {}),
      ...(state.lastError ? { lastError: state.lastError } : {}),
    };
  }

  /** One sync at a time; a request during a sync waits for it. */
  async function sync(): Promise<void> {
    if (running) return running;
    if (!(await session())) return;
    running = createSync({ repo: deps.repo, remote: supabaseRemote(supabase()), state: syncState })
      .run()
      .then((r) => {
        if (r.changed) deps.onDataChanged();
      })
      .catch((err) => console.warn("[leettrack] sync", err))
      .finally(() => {
        running = null;
      });
    return running;
  }

  return {
    status,
    sync,
    /** Sync a few seconds after local changes, batching bursts of edits. */
    syncSoon(delayMs = 5000) {
      if (!ACCOUNT_CONFIGURED) return;
      clearTimeout(timer);
      timer = setTimeout(() => void sync(), delayMs);
    },
    /**
     * Sign in with GitHub in Chrome's own sign-in window: GitHub (instant if you've approved
     * before), then straight back here with a one-time code that becomes this browser's session.
     */
    async signInWithGitHub(): Promise<SyncStatus> {
      if (!ACCOUNT_CONFIGURED)
        throw new Error("This build of LeetTrack has no account server set up.");
      const redirectTo = browser.identity.getRedirectURL();
      const { data, error: startError } = await supabase().auth.signInWithOAuth({
        provider: "github",
        options: { redirectTo, skipBrowserRedirect: true },
      });
      if (startError || !data.url)
        throw new Error(`Couldn't start sign-in: ${startError?.message ?? "no sign-in page"}`);
      let returned: string | undefined;
      try {
        returned = await browser.identity.launchWebAuthFlow({ url: data.url, interactive: true });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new Error(
          /cancel|closed|did not approve/i.test(msg)
            ? "Sign-in was cancelled."
            : `Sign-in failed: ${msg}`,
        );
      }
      const back = new URL(returned ?? redirectTo);
      const params = new URLSearchParams(back.search || back.hash.slice(1));
      const code = params.get("code");
      if (!code)
        throw new Error(
          `Sign-in failed: ${params.get("error_description") ?? params.get("error") ?? "no code came back"}`,
        );
      const { error } = await supabase().auth.exchangeCodeForSession(code);
      if (error) throw new Error(`Sign-in failed: ${error.message}`);
      // A fresh start: push everything here, pull everything there.
      await syncState.set({});
      await sync();
      return status();
    },
    async signOut(): Promise<SyncStatus> {
      if (ACCOUNT_CONFIGURED)
        await supabase()
          .auth.signOut({ scope: "local" })
          .catch(() => {});
      await syncState.set({});
      return status();
    },
  };
}
