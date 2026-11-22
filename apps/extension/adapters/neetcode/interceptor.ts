import { CONTENT_SOURCE, PAGE_SOURCE } from "../page/constants";
import type { ContentRequest, PageEnvelope, PageEvent } from "../page/events";
import { watchRequests } from "../page/network";
import { isSubmitUrl, parseSubmitRequest, parseSubmitResponse } from "./parse";

// Runs in neetcode.io's MAIN world. Submit is one request whose response carries the verdict,
// so each one posts "started" (with the code) and then its result. Events carry NeetCode's
// slug; the isolated script maps it to LeetCode's.

export interface NeetcodeInterceptorOptions {
  /** Log raw submit payloads so they can be saved as test fixtures. */
  record?: boolean;
  now?: () => Date;
}

const INSTALLED = Symbol.for("leettrack.neetcode-interceptor");

export function installNeetcodeInterceptor(
  win: Window & typeof globalThis,
  opts: NeetcodeInterceptorOptions = {},
) {
  const w = win as unknown as Record<symbol, boolean>;
  if (w[INSTALLED]) return;
  w[INSTALLED] = true;

  const now = opts.now ?? (() => new Date());
  let count = 0;
  const post = (event: PageEvent) => {
    const envelope: PageEnvelope = { source: PAGE_SOURCE, event };
    win.postMessage(envelope, win.location.origin);
  };

  watchRequests(
    win,
    (url, method) => method === "POST" && isSubmitUrl(url),
    (url, _method, requestBody, responseBody) => {
      if (opts.record)
        console.debug("[leettrack:record]", JSON.stringify({ url, requestBody, responseBody }));
      const req = parseSubmitRequest(requestBody);
      if (!req) return;
      const at = now().toISOString();
      const submissionId = `neetcode-${Date.parse(at).toString(36)}-${(count += 1)}`;
      post({
        type: "submission-started",
        slug: req.neetcodeSlug,
        submissionId,
        at,
        ...(req.lang ? { lang: req.lang } : {}),
        ...(req.code !== undefined ? { code: req.code } : {}),
      });
      const result = parseSubmitResponse(responseBody, at);
      if (result)
        post({
          ...result,
          slug: req.neetcodeSlug,
          submissionId,
          ...(req.lang ? { lang: req.lang } : {}),
        });
    },
  );

  // NeetCode doesn't expose its editor; the code always arrives with Submit. Answer right away
  // so the panel doesn't wait out the timeout.
  win.addEventListener("message", (e: MessageEvent) => {
    if (e.source !== win) return;
    const data = e.data as Partial<ContentRequest> | null;
    if (data?.source !== CONTENT_SOURCE || data.type !== "request-editor-code") return;
    if (typeof data.requestId !== "string") return;
    post({ type: "editor-code", requestId: data.requestId });
  });
}
