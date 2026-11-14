// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { installInterceptor } from "../interceptor";
import { PAGE_SOURCE, type PageEvent } from "../events";
import accepted from "../__fixtures__/check-accepted.json";
import submitReq from "../__fixtures__/submit-request.json";

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

describe("installInterceptor", () => {
  let events: PageEvent[];
  let postSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    events = [];
    const routes: Record<string, unknown> = {
      "/problems/two-sum/submit/": { submission_id: 1234567890 },
      "/submissions/detail/1234567890/check/": accepted,
      "/submissions/detail/runcode_1/check/": { ...accepted, submission_id: "runcode_1" },
      "/problems/two-sum/interpret_solution/": { interpret_id: "runcode_1" },
    };
    window.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(
        typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
        "https://leetcode.com",
      );
      return json(routes[url.pathname] ?? {});
    }) as typeof fetch;
    postSpy = vi.spyOn(window, "postMessage").mockImplementation((msg: unknown) => {
      const m = msg as { source: string; event: PageEvent };
      if (m.source === PAGE_SOURCE) events.push(m.event);
    });
    installInterceptor(window as Window & typeof globalThis);
  });
  afterEach(() => {
    postSpy.mockRestore();
    delete (window as unknown as Record<symbol, unknown>)[Symbol.for("leettrack.interceptor")];
  });

  const flush = () => new Promise((r) => setTimeout(r, 10));

  it("emits started + result for a submit, and ignores Run polls", async () => {
    await fetch("/problems/two-sum/interpret_solution/", { method: "POST", body: "{}" });
    await fetch("/submissions/detail/runcode_1/check/");
    await fetch("/problems/two-sum/submit/", { method: "POST", body: JSON.stringify(submitReq) });
    await flush();
    await fetch("/submissions/detail/1234567890/check/");
    await fetch("/submissions/detail/1234567890/check/"); // duplicate poll
    await flush();
    expect(events.map((e) => e.type)).toEqual(["submission-started", "submission-result"]);
    expect(events[0]).toMatchObject({
      slug: "two-sum",
      submissionId: "1234567890",
      lang: "python3",
    });
    expect(events[1]).toMatchObject({
      slug: "two-sum",
      status: "Accepted",
      accepted: true,
      runtimeMs: 3,
    });
  });

  it("returns the original response untouched", async () => {
    const res = await fetch("/problems/two-sum/submit/", { method: "POST", body: "{}" });
    expect(await res.json()).toEqual({ submission_id: 1234567890 });
  });
});
