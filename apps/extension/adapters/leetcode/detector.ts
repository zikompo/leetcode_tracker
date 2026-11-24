import { listenToPage } from "../page/bridge";
import { observeResultBanner } from "./dom-fallback";
import type { SubmissionResult, SubmissionStarted } from "../page/events";
import { parseProblemUrl } from "./url";

export interface DetectorCallbacks {
  onStarted(event: SubmissionStarted): void;
  onResult(event: SubmissionResult): void;
}

export interface DetectorOptions {
  /** How long to wait for a network result before trusting the DOM banner. */
  domGraceMs?: number;
  now?: () => number;
}

/**
 * Combines the network interceptor (primary) with the DOM banner (fallback) into one
 * deduplicated stream of submission events for the current page.
 */
export function createSubmissionDetector(
  win: Window,
  cb: DetectorCallbacks,
  opts: DetectorOptions = {},
) {
  const graceMs = opts.domGraceMs ?? 3000;
  const now = opts.now ?? Date.now;
  const started = new Map<string, SubmissionStarted>();
  let lastNetworkResultAt = -Infinity;
  const timers = new Set<ReturnType<typeof setTimeout>>();

  const stopPage = listenToPage(win, (event) => {
    if (event.type === "submission-started") {
      started.set(event.submissionId, event);
      cb.onStarted(event);
    } else if (event.type === "submission-result") {
      lastNetworkResultAt = now();
      const s = event.submissionId ? started.get(event.submissionId) : undefined;
      cb.onResult({ ...event, slug: event.slug ?? s?.slug, lang: event.lang ?? s?.lang });
    }
  });

  const stopDom = observeResultBanner(win.document, (status) => {
    const seenAt = now();
    const timer = setTimeout(() => {
      timers.delete(timer);
      // A network result within the window around this banner means it was already handled.
      if (lastNetworkResultAt >= seenAt - 15_000) return;
      const loc = parseProblemUrl(win.location.href);
      // Only trust banners on a submission page, so "Run" results are never logged as submissions.
      if (!loc || loc.tab !== "submissions") return;
      cb.onResult({
        type: "submission-result",
        slug: loc.slug,
        at: new Date(seenAt).toISOString(),
        status,
        accepted: status === "Accepted",
        source: "dom",
      });
    }, graceMs);
    timers.add(timer);
  });

  return () => {
    stopPage();
    stopDom();
    timers.forEach(clearTimeout);
  };
}
