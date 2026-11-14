import { RESULT_TEXTS } from "./parse";

// Fallback detector: watches for LeetCode's submission result banner.
// Verified 2026-11-14: the banner is `<span data-e2e-locator="submission-result">Accepted</span>`.
export const RESULT_SELECTOR = '[data-e2e-locator="submission-result"]';

const KNOWN = new Set(RESULT_TEXTS);

/**
 * Calls `onResult` once per newly-appearing result banner. Banners present when observation
 * starts (e.g. an old submission page) are ignored.
 */
export function observeResultBanner(doc: Document, onResult: (status: string) => void): () => void {
  const seen = new WeakSet<Element>();
  doc.querySelectorAll(RESULT_SELECTOR).forEach((el) => seen.add(el));

  const scan = () => {
    doc.querySelectorAll(RESULT_SELECTOR).forEach((el) => {
      if (seen.has(el)) return;
      const text = el.textContent?.trim() ?? "";
      if (!KNOWN.has(text)) return; // not rendered yet; check again on the next mutation
      seen.add(el);
      onResult(text);
    });
  };
  const observer = new MutationObserver(scan);
  observer.observe(doc.documentElement, { childList: true, subtree: true, characterData: true });
  return () => observer.disconnect();
}
