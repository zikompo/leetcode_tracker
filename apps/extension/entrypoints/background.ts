import { browser } from "wxt/browser";
import { ACCOUNT_ENV, createAccount, isHandoff } from "@/lib/account";
import { createAiService } from "@/lib/ai";
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
const MIDNIGHT_ALARM = "leettrack-midnight";

export default defineBackground(() => {
  const account = createAccount({ repo: idbRepo, onDataChanged: () => void refreshBadge() });
  const service = {
    ...createService(idbRepo, chromeSessionStore),
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
  scheduleMidnight();
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === MIDNIGHT_ALARM) scheduleMidnight();
    if (alarm.name === BADGE_ALARM || alarm.name === MIDNIGHT_ALARM) void refreshBadge();
    if (alarm.name === SYNC_ALARM) void account.sync();
  });
  browser.runtime.onStartup.addListener(() => {
    void refreshBadge();
    void account.sync();
  });
  browser.runtime.onInstalled.addListener(() => void refreshBadge());
  void refreshBadge();

  browser.runtime.onMessage.addListener((message: unknown, sender, sendResponse) => {
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
