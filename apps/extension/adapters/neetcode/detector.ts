import { listenToPage } from "../page/bridge";
import type { SubmissionResult, SubmissionStarted } from "../page/events";
import { leettrackSlugFor } from "./metadata";

export interface NeetcodeDetectorCallbacks {
  onStarted(event: SubmissionStarted): void;
  onResult(event: SubmissionResult): void;
}

/**
 * Submission events from the NeetCode interceptor, with NeetCode's slug swapped for the one
 * LeetTrack keys the problem by. NeetCode's verdict comes back with the request itself, so
 * there's no DOM fallback to reconcile.
 */
export function createNeetcodeDetector(win: Window, cb: NeetcodeDetectorCallbacks) {
  return listenToPage(win, (event) => {
    if (event.type === "submission-started")
      cb.onStarted({ ...event, slug: leettrackSlugFor(event.slug) });
    else if (event.type === "submission-result")
      cb.onResult({ ...event, ...(event.slug ? { slug: leettrackSlugFor(event.slug) } : {}) });
  });
}
