import { browser } from "wxt/browser";
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
const BADGE_ALARM = "leettrack-badge";
const MIDNIGHT_ALARM = "leettrack-midnight";

export default defineBackground(() => {
  const service = { ...createService(idbRepo, chromeSessionStore), ...createAiService() };

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
  scheduleMidnight();
  browser.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === MIDNIGHT_ALARM) scheduleMidnight();
    if (alarm.name === BADGE_ALARM || alarm.name === MIDNIGHT_ALARM) void refreshBadge();
  });
  browser.runtime.onStartup.addListener(() => void refreshBadge());
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
      },
      (err: unknown) =>
        sendResponse({
          ok: false,
          error: err instanceof Error ? err.message : String(err),
        } satisfies ApiResponse),
    );
    return true; // async response
  });
});
