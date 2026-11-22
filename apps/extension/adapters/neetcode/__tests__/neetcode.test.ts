// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PAGE_SOURCE, type PageEvent, type SubmissionResult } from "../../page/events";
import { createNeetcodeDetector } from "../detector";
import { installNeetcodeInterceptor } from "../interceptor";
import { fetchNeetcodeMetadata, leettrackSlugFor } from "../metadata";
import { isSubmitUrl, parseSubmitRequest, parseSubmitResponse } from "../parse";
import { isNeetcodeSolutionTab, parseNeetcodeUrl } from "../url";
import accepted from "../__fixtures__/submit-accepted.json";
import submitReq from "../__fixtures__/submit-request.json";
import wrong from "../__fixtures__/submit-wrong-answer.json";

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { "content-type": "application/json" },
  });

describe("parseNeetcodeUrl", () => {
  it.each([
    [
      "https://neetcode.io/problems/two-integer-sum",
      { neetcodeSlug: "two-integer-sum", tab: "question" },
    ],
    [
      "https://neetcode.io/problems/two-integer-sum/question",
      { neetcodeSlug: "two-integer-sum", tab: "question" },
    ],
    [
      "https://neetcode.io/problems/two-integer-sum/solution",
      { neetcodeSlug: "two-integer-sum", tab: "solution" },
    ],
    [
      "https://neetcode.io/problems/two-integer-sum/whatever",
      { neetcodeSlug: "two-integer-sum", tab: "other" },
    ],
  ])("%s", (url, expected) => expect(parseNeetcodeUrl(url)).toEqual(expected));

  it.each([
    "https://neetcode.io/practice",
    "https://neetcode.io/courses/dsa-for-beginners/26",
    "https://leetcode.com/problems/two-sum/",
    "not a url",
  ])("ignores %s", (url) => expect(parseNeetcodeUrl(url)).toBeNull());

  it("counts the Solution tab as help", () => {
    expect(isNeetcodeSolutionTab("solution")).toBe(true);
    expect(isNeetcodeSolutionTab("question")).toBe(false);
  });
});

describe("NeetCode slugs", () => {
  it("map to LeetCode's for NeetCode's list problems, and stay as they are otherwise", () => {
    expect(leettrackSlugFor("two-integer-sum")).toBe("two-sum");
    expect(leettrackSlugFor("duplicate-integer")).toBe("contains-duplicate");
    expect(leettrackSlugFor("some-neetcode-only-problem")).toBe("some-neetcode-only-problem");
  });
});

describe("parse", () => {
  it("recognizes Submit, not Run", () => {
    expect(isSubmitUrl("https://neetcode.io/api/executeCodeFunctionHttp")).toBe(true);
    expect(isSubmitUrl("/api/executeCodeFunctionHttp")).toBe(true);
    expect(isSubmitUrl("/api/runCodeFunctionHttp")).toBe(false);
  });

  it("reads the problem, code and language from the request", () => {
    expect(parseSubmitRequest(JSON.stringify(submitReq))).toEqual({
      neetcodeSlug: "two-integer-sum",
      code: submitReq.data.rawCode,
      lang: "python",
    });
    expect(parseSubmitRequest("{")).toBeNull();
    expect(parseSubmitRequest({ data: {} })).toBeNull();
  });

  it("reads the verdict, with runtime and memory for an Accepted", () => {
    expect(parseSubmitResponse(accepted, "t")).toEqual({
      type: "submission-result",
      at: "t",
      status: "Accepted",
      accepted: true,
      runtimeMs: 51,
      memoryMb: 16.84,
      source: "network",
    });
    expect(parseSubmitResponse(wrong, "t")).toMatchObject({
      status: "Wrong Answer",
      accepted: false,
    });
    expect(parseSubmitResponse(wrong, "t")).not.toHaveProperty("runtimeMs");
    // Firebase's own wrapper name, and Judge0's id when the description differs in case.
    expect(
      parseSubmitResponse({ result: { status: { id: 3, description: "accepted" } } }, "t"),
    ).toMatchObject({ status: "Accepted", accepted: true });
  });

  it("isn't fooled by errors", () => {
    expect(parseSubmitResponse({ error: { message: "Authentication required" } }, "t")).toBeNull();
    expect(parseSubmitResponse({ data: {} }, "t")).toBeNull();
    expect(parseSubmitResponse(undefined, "t")).toBeNull();
  });
});

describe("installNeetcodeInterceptor + createNeetcodeDetector", () => {
  let events: PageEvent[];
  let postSpy: ReturnType<typeof vi.spyOn>;
  let verdict: unknown;

  beforeEach(() => {
    events = [];
    verdict = accepted;
    window.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(
        typeof input === "string" ? input : input instanceof URL ? input.href : input.url,
        "https://neetcode.io",
      );
      if (url.pathname === "/api/executeCodeFunctionHttp") return json(verdict);
      if (url.pathname === "/api/runCodeFunctionHttp") return json(accepted);
      return json({});
    }) as typeof fetch;
    postSpy = vi.spyOn(window, "postMessage").mockImplementation((msg: unknown) => {
      const m = msg as { source: string; event: PageEvent };
      if (m.source === PAGE_SOURCE) events.push(m.event);
    });
    installNeetcodeInterceptor(window as Window & typeof globalThis, {
      now: () => new Date("2026-11-21T20:00:00Z"),
    });
  });
  afterEach(() => {
    postSpy.mockRestore();
    delete (window as unknown as Record<symbol, unknown>)[
      Symbol.for("leettrack.neetcode-interceptor")
    ];
  });
  const flush = () => new Promise((r) => setTimeout(r, 10));

  it("posts started (with the code) and the verdict for Submit, and ignores Run", async () => {
    const body = JSON.stringify(submitReq);
    await fetch("/api/runCodeFunctionHttp", { method: "POST", body });
    await fetch("/api/executeCodeFunctionHttp", { method: "POST", body });
    await flush();
    expect(events.map((e) => e.type)).toEqual(["submission-started", "submission-result"]);
    expect(events[0]).toMatchObject({
      slug: "two-integer-sum",
      lang: "python",
      code: submitReq.data.rawCode,
    });
    expect(events[1]).toMatchObject({ slug: "two-integer-sum", accepted: true, lang: "python" });
    expect((events[0] as { submissionId: string }).submissionId).toBe(
      (events[1] as SubmissionResult).submissionId,
    );
  });

  it("a failed request posts started but no verdict", async () => {
    verdict = { error: { message: "Authentication required" } };
    await fetch("/api/executeCodeFunctionHttp", {
      method: "POST",
      body: JSON.stringify(submitReq),
    });
    await flush();
    expect(events.map((e) => e.type)).toEqual(["submission-started"]);
  });

  it("the detector hands on events under LeetCode's slug", () => {
    const seen: string[] = [];
    let listener: ((e: MessageEvent) => void) | undefined;
    const fakeWin = {
      location: { origin: "https://neetcode.io" },
      addEventListener: (_: string, l: (e: MessageEvent) => void) => (listener = l),
      removeEventListener: () => {},
    } as unknown as Window;
    const stop = createNeetcodeDetector(fakeWin, {
      onStarted: (e) => seen.push(`started ${e.slug}`),
      onResult: (e) => seen.push(`result ${e.slug} ${e.status}`),
    });
    const send = (event: PageEvent) =>
      listener!({
        source: fakeWin,
        origin: "https://neetcode.io",
        data: { source: PAGE_SOURCE, event },
      } as unknown as MessageEvent);
    send({ type: "submission-started", slug: "two-integer-sum", submissionId: "1", at: "t" });
    send({
      type: "submission-result",
      slug: "two-integer-sum",
      submissionId: "1",
      at: "t",
      status: "Accepted",
      accepted: true,
      source: "network",
    });
    stop();
    expect(seen).toEqual(["started two-sum", "result two-sum Accepted"]);
  });
});

describe("fetchNeetcodeMetadata", () => {
  const meta = { data: { name: "Two Sum", difficulty: "Easy", topics: ["Array", "Hash Table"] } };

  it("uses the seed's LeetCode facts for list problems, with NeetCode's topics", async () => {
    const f = vi.fn(async () => json(meta)) as unknown as typeof fetch;
    expect(await fetchNeetcodeMetadata("two-integer-sum", f)).toEqual({
      slug: "two-sum",
      frontendId: "1",
      title: "Two Sum",
      difficulty: "Easy",
      url: "https://leetcode.com/problems/two-sum/",
      leetcodeTopics: ["Array", "Hash Table"],
      isPaidOnly: false,
    });
    const [, init] = (f as unknown as ReturnType<typeof vi.fn>).mock.calls[0]!;
    expect(JSON.parse(init.body)).toEqual({ data: { problemId: "two-integer-sum" } });
  });

  it("keeps other problems on NeetCode, under NeetCode's slug and name", async () => {
    const other = { data: { name: "Some Problem", difficulty: "Hard" } };
    const f = vi.fn(async () => json(other)) as unknown as typeof fetch;
    expect(await fetchNeetcodeMetadata("some-problem", f)).toMatchObject({
      slug: "some-problem",
      frontendId: "",
      title: "Some Problem",
      difficulty: "Hard",
      url: "https://neetcode.io/problems/some-problem/question",
      leetcodeTopics: [],
    });
  });

  it("gives up quietly when NeetCode doesn't answer", async () => {
    const f = vi.fn(async () => new Response("nope", { status: 500 })) as unknown as typeof fetch;
    expect(await fetchNeetcodeMetadata("two-integer-sum", f)).toBeNull();
  });
});
