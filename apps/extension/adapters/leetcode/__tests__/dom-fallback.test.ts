// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { observeResultBanner, RESULT_SELECTOR } from "../dom-fallback";
import { createSubmissionDetector } from "../detector";
import { PAGE_SOURCE } from "../../page/events";

const banner = (text: string) => {
  const span = document.createElement("span");
  span.setAttribute("data-e2e-locator", "submission-result");
  span.textContent = text;
  document.body.appendChild(span);
  return span;
};
const tick = () => new Promise((r) => setTimeout(r, 0));
const setUrl = (url: string) =>
  (window as unknown as { happyDOM: { setURL(u: string): void } }).happyDOM.setURL(url);

afterEach(() => {
  document.body.innerHTML = "";
  vi.useRealTimers();
});

describe("observeResultBanner", () => {
  it("reports new banners once and ignores pre-existing ones", async () => {
    banner("Wrong Answer");
    const seen: string[] = [];
    const stop = observeResultBanner(document, (s) => seen.push(s));
    banner("Accepted");
    await tick();
    document.body.appendChild(document.createElement("div")); // unrelated mutation
    await tick();
    expect(seen).toEqual(["Accepted"]);
    expect(document.querySelectorAll(RESULT_SELECTOR)).toHaveLength(2);
    stop();
  });

  it("waits until the banner has known text", async () => {
    const seen: string[] = [];
    observeResultBanner(document, (s) => seen.push(s));
    const el = banner("");
    await tick();
    expect(seen).toEqual([]);
    el.textContent = "Time Limit Exceeded";
    await tick();
    expect(seen).toEqual(["Time Limit Exceeded"]);
  });
});

describe("createSubmissionDetector", () => {
  it("uses the DOM banner only when no network result arrived, and only on a submissions page", async () => {
    setUrl("https://leetcode.com/problems/two-sum/submissions/99/");
    const results: unknown[] = [];
    const stop = createSubmissionDetector(
      window,
      { onStarted: () => {}, onResult: (r) => results.push(r) },
      { domGraceMs: 20 },
    );
    banner("Accepted");
    await new Promise((r) => setTimeout(r, 60));
    expect(results).toEqual([
      expect.objectContaining({
        slug: "two-sum",
        status: "Accepted",
        accepted: true,
        source: "dom",
      }),
    ]);
    stop();
  });

  it("prefers the network result and drops the matching banner", async () => {
    setUrl("https://leetcode.com/problems/two-sum/submissions/99/");
    const results: Array<{ source: string }> = [];
    const stop = createSubmissionDetector(
      window,
      { onStarted: () => {}, onResult: (r) => results.push(r) },
      { domGraceMs: 20 },
    );
    // Simulate the MAIN-world script posting a network result.
    window.dispatchEvent(
      new MessageEvent("message", {
        source: window,
        origin: window.location.origin,
        data: {
          source: PAGE_SOURCE,
          event: {
            type: "submission-result",
            slug: "two-sum",
            submissionId: "1",
            at: "x",
            status: "Accepted",
            accepted: true,
            source: "network",
          },
        },
      }),
    );
    banner("Accepted");
    await new Promise((r) => setTimeout(r, 60));
    expect(results.map((r) => r.source)).toEqual(["network"]);
    stop();
  });

  it("ignores banners off the submissions page (e.g. Run results)", async () => {
    setUrl("https://leetcode.com/problems/two-sum/description/");
    const results: unknown[] = [];
    const stop = createSubmissionDetector(
      window,
      { onStarted: () => {}, onResult: (r) => results.push(r) },
      { domGraceMs: 10 },
    );
    banner("Accepted");
    await new Promise((r) => setTimeout(r, 40));
    expect(results).toEqual([]);
    stop();
  });

  it("rejects messages with the wrong shape", async () => {
    const results: unknown[] = [];
    const stop = createSubmissionDetector(window, {
      onStarted: (e) => results.push(e),
      onResult: (r) => results.push(r),
    });
    window.dispatchEvent(
      new MessageEvent("message", {
        source: window,
        origin: window.location.origin,
        data: { source: PAGE_SOURCE, event: { type: "submission-result", status: 5 } },
      }),
    );
    await tick();
    expect(results).toEqual([]);
    stop();
  });
});
