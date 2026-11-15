import { browser } from "wxt/browser";
import { ACCOUNT_ENV, createAccount, isHandoff } from "@/lib/account";
import { createAiService } from "@/lib/ai";
import { GITHUB_ENV, chromeGitHubStore, githubApi } from "@/lib/github/chrome";
import { createGitHub } from "@/lib/github/service";
import { chromeSessionStore, idbRepo } from "@/lib/db";
import { createService } from "@/lib/service";
import type { ApiMethod, ApiRequest, ApiResponse } from "@/lib/types";

/** Calls that can change what's due, after which the badge is recounted. */
const CHANGES_QUEUE: ReadonlySet<ApiMethod> = new Set<ApiMethod>([
  "saveAttempt",
  "setStatusOverride",
  "setSettings",
  "importData",
  "mergePattern",
]);
/** Calls that change synced data; a sync follows a few seconds later. */
const CHANGES_DATA: ReadonlySet<ApiMethod> = new Set<ApiMethod>([
  ...CHANGES_QUEUE,
  "upsertProblemMeta",
  "addCustomPattern",
  "renamePattern",
]);
const BADGE_ALARM = "leettrack-badge";
const SYNC_ALARM = "leettrack-sync";
const GITHUB_ALARM = "leettrack-github";
const MIDNIGHT_ALARM = "leettrack-midnight";

export default defineBackground(() => {
  const account = createAccount({ repo: idbRepo, onDataChanged: () => void refreshBadge() });
  const data = createService(idbRepo, chromeSessionStore);
  const github = createGitHub({
    repo: idbRepo,
    store: chromeGitHubStore,
    api: githubApi(),
    appSlug: GITHUB_ENV.appSlug,
    getSettings: () => data.getSettings(),
    setSettings: (patch) => data.setSettings(patch),
  });
  const service = {
    ...data,
    githubStatus: () => github.status(),
    githubStartConnect: () => github.startConnect(),
    githubPollConnect: () => github.pollConnect(),
    githubListRepos: () => github.listRepos(),
    githubSelectRepo: async (choice: { owner: string; repo: string; branch: string }) => {
      const status = await github.selectRepo(choice);
      account.syncSoon(); // the repo choice is part of the synced settings
      return status;
    },
    githubSetIncludeNotes: (on: boolean) => github.setIncludeNotes(on),
    githubBackfillCount: () => github.backfillCount(),
    githubBackfill: async () => {
      const n = await github.backfill();
      void github.process();
      return n;
    },
    githubRetryNow: () => github.retryNow(),
    githubDisconnect: () => github.disconnect(),
    ...createAiService(),
    getSyncStatus: () => account.status(),
    syncNow: async () => {
      await account.sync();
      return account.status();
    },
    signOut: () => account.signOut(),
  };

  /** Toolbar badge: reviews in today's queue (spec 4.6). */
  async function refreshBadge() {
    try {
      const queue = await service.getQueue();
      const count = queue.items.filter((i) => i.kind === "review").length;
      await browser.action.setBadgeBackgroundColor({ color: "#2f6fdf" });
      await browser.action.setBadgeText({ text: count > 0 ? String(count) : "" });
    } catch (err) {
      console.warn("[leettrack] badge", err);
    }
  }

  /** Recount just after local midnight, when a new day's reviews become due. */
  function scheduleMidnight() {
    const now = new Date();
    const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 1);
    void browser.alarms.create(MIDNIGHT_ALARM, { when: next.getTime() });
  }

  void browser.alarms.create(BADGE_ALARM, { periodInMinutes: 60 });
  void browser.alarms.create(SYNC_ALARM, { periodInMinutes: 15 });
  void browser.alarms.create(GITHUB_ALARM, { periodInMinutes: 5 });
  scheduleMidnight();
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === MIDNIGHT_ALARM) scheduleMidnight();
    if (alarm.name === BADGE_ALARM || alarm.name === MIDNIGHT_ALARM) void refreshBadge();
    if (alarm.name === SYNC_ALARM) void account.sync();
    if (alarm.name === GITHUB_ALARM) void github.process();
  });
  browser.runtime.onStartup.addListener(() => {
    void refreshBadge();
    void account.sync();
  });
  browser.runtime.onInstalled.addListener((details) => {
    void refreshBadge();
    // First install: a short setup page (lists, interview date, panel, import, sign-in).
    if (details.reason === "install") {
      void browser.tabs.create({ url: browser.runtime.getURL("/onboarding.html") });
    }
  });
  void refreshBadge();

  /**
   * The side panel opens on the toolbar icon when it's the chosen panel style; otherwise the
   * icon opens the popup.
   */
  async function syncPanelBehavior() {
    try {
      const s = await service.getSettings();
      await browser.sidePanel.setPanelBehavior({
        openPanelOnActionClick: s.panelStyle === "side",
      });
    } catch {
      // sidePanel isn't available (an older Chrome): the popup still works
    }
  }
  void syncPanelBehavior();

  browser.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
    // From the page's "Open side panel" button: open it right away, while the click still
    // counts as the user's (Chrome only opens the side panel in response to one).
    if ((message as { kind?: string } | null)?.kind === "leettrack-open-side-panel") {
      const tabId = sender.tab?.id;
      if (sender.id !== browser.runtime.id || tabId === undefined) return false;
      browser.sidePanel.open({ tabId }).then(
        () => sendResponse({ ok: true }),
        (err: unknown) => sendResponse({ ok: false, error: String(err) }),
      );
      return true;
    }
    const req = message as Partial<ApiRequest> | null;
    if (req?.kind !== "leettrack-api" || sender.id !== browser.runtime.id) return false;
    const handler = service[req.method as keyof typeof service] as
      ((...a: unknown[]) => Promise<unknown>) | undefined;
    if (!handler || !Array.isArray(req.args)) {
      sendResponse({
        ok: false,
        error: `Unknown method ${String(req.method)}`,
      } satisfies ApiResponse);
      return false;
    }
    handler(...req.args).then(
      (value) => {
        sendResponse({ ok: true, value } satisfies ApiResponse);
        if (CHANGES_QUEUE.has(req.method as ApiMethod)) void refreshBadge();
        if (CHANGES_DATA.has(req.method as ApiMethod)) account.syncSoon();
        if (req.method === "setSettings") void syncPanelBehavior();
        // Commit to GitHub in the background; saving never waits on it (spec 8.2).
        if (req.method === "saveAttempt") {
          const id = (req.args?.[0] as { attempt?: { id?: string } } | undefined)?.attempt?.id;
          if (id) {
            void github
              .onAttemptSaved(id)
              .then(async (queued) => {
                if (queued) await github.process();
              })
              .catch((err: unknown) => console.warn("[leettrack] github", err));
          }
        }
      },
      (err: unknown) =>
        sendResponse({
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        } satisfies ApiResponse),
    );
    return true; // async response
  });

  // Sign-in handoff from the website (spec 10.3). Chrome only delivers messages from the
  // origins in the manifest's externally_connectable; check the sender again anyway.
  const websiteOrigin = new URL(ACCOUNT_ENV.websiteUrl).origin;
  browser.runtime.onMessageExternal.addListener((message: unknown, sender, sendResponse) => {
    const origin = sender.url ? new URL(sender.url).origin : sender.origin;
    if (origin !== websiteOrigin || !isHandoff(message)) {
      sendResponse({ ok: false, error: "Not accepted." });
      return false;
    }
    account.signIn(message).then(
      (status) =>
        sendResponse({
          ok: status.signedIn,
          ...(status.signedIn ? {} : { error: "Sign-in failed." }),
        }),
      (err: unknown) =>
        sendResponse({ ok: false, error: err instanceof Error ? err.message : String(err) }),
    );
    return true;
  });
});
