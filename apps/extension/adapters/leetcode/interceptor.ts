import { CONTENT_SOURCE, PAGE_SOURCE } from "./constants";
import type { ContentRequest, PageEnvelope, PageEvent } from "./events";
import { readEditorCode } from "./editor";
import {
  matchCheckUrl,
  matchSubmitUrl,
  parseCheckResponse,
  parseSubmitRequestBody,
  parseSubmitResponse,
} from "./parse";

// Runs in the page's MAIN world. Wraps fetch + XMLHttpRequest to observe the user's own
// submissions, and posts normalized events to the isolated content script.

export interface InterceptorOptions {
  /** Dev only: log raw submit/check payloads so they can be saved as test fixtures. */
  record?: boolean;
  now?: () => Date;
}

const INSTALLED = Symbol.for("leettrack.interceptor");

export function installInterceptor(win: Window & typeof globalThis, opts: InterceptorOptions = {}) {
  const w = win as unknown as Record<symbol, boolean>;
  if (w[INSTALLED]) return;
  w[INSTALLED] = true;

  const now = opts.now ?? (() => new Date());
  /** submission id → slug, only for ids returned by a real Submit (not Run). */
  const submitted = new Map<string, string>();
  const resolved = new Set<string>();

  const post = (event: PageEvent) => {
    const envelope: PageEnvelope = { source: PAGE_SOURCE, event };
    win.postMessage(envelope, win.location.origin);
  };

  const record = (kind: string, url: string, requestBody: unknown, responseBody: unknown) => {
    if (opts.record)
      console.debug("[leettrack:record]", JSON.stringify({ kind, url, requestBody, responseBody }));
  };

  function onSubmit(slug: string, url: string, requestBody: unknown, responseBody: unknown) {
    record("submit", url, requestBody, responseBody);
    const req = parseSubmitRequestBody(requestBody);
    const started = parseSubmitResponse(slug, responseBody, req, now().toISOString());
    if (!started) return;
    submitted.set(started.submissionId, slug);
    post(started);
  }

  function onCheck(id: string, url: string, responseBody: unknown) {
    const slug = submitted.get(id);
    if (!slug || resolved.has(id)) return; // ignore "Run" polls and duplicates
    record("check", url, undefined, responseBody);
    const result = parseCheckResponse(id, responseBody, now().toISOString());
    if (!result) return;
    resolved.add(id);
    post({ ...result, slug });
  }

  const handle = (url: string, method: string, requestBody: unknown, responseBody: unknown) => {
    const slug = method === "POST" ? matchSubmitUrl(url) : null;
    if (slug) return onSubmit(slug, url, requestBody, responseBody);
    const id = matchCheckUrl(url);
    if (id) onCheck(id, url, responseBody);
  };

  const isInteresting = (url: string) =>
    matchSubmitUrl(url) !== null || matchCheckUrl(url) !== null;
  const safeJson = (text: string): unknown => {
    try {
      return JSON.parse(text);
    } catch {
      return undefined;
    }
  };

  // --- fetch ---
  const originalFetch = win.fetch;
  win.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const interesting = isInteresting(url);
    const method = (
      init?.method ?? (input instanceof Request ? input.method : "GET")
    ).toUpperCase();
    let requestBodyPromise: Promise<unknown> | undefined;
    if (interesting && method === "POST") {
      if (init?.body !== undefined) requestBodyPromise = Promise.resolve(init.body);
      else if (input instanceof Request)
        requestBodyPromise = input
          .clone()
          .text()
          .catch(() => undefined);
    }
    const response = await originalFetch.call(win, input, init);
    if (interesting) {
      const copy = response.clone();
      void (async () => {
        try {
          const [reqBody, text] = await Promise.all([requestBodyPromise, copy.text()]);
          handle(url, method, reqBody, safeJson(text));
        } catch {
          /* never break the page */
        }
      })();
    }
    return response;
  } as typeof fetch;

  // --- XMLHttpRequest ---
  const XHR = win.XMLHttpRequest;
  if (XHR) {
    const meta = new WeakMap<XMLHttpRequest, { method: string; url: string }>();
    const originalOpen = XHR.prototype.open;
    const originalSend = XHR.prototype.send;
    XHR.prototype.open = function (
      this: XMLHttpRequest,
      method: string,
      url: string | URL,
      ...rest: unknown[]
    ) {
      meta.set(this, { method: method.toUpperCase(), url: String(url) });
      return (originalOpen as (...a: unknown[]) => void).call(this, method, url, ...rest);
    } as typeof XHR.prototype.open;
    XHR.prototype.send = function (
      this: XMLHttpRequest,
      body?: Document | XMLHttpRequestBodyInit | null,
    ) {
      const m = meta.get(this);
      if (m && isInteresting(m.url)) {
        this.addEventListener("load", () => {
          try {
            const res =
              this.responseType === "json"
                ? this.response
                : this.responseType === "" || this.responseType === "text"
                  ? safeJson(this.responseText)
                  : undefined;
            handle(m.url, m.method, body, res);
          } catch {
            /* never break the page */
          }
        });
      }
      return originalSend.call(this, body);
    };
  }

  // --- editor code requests from the isolated script ---
  win.addEventListener("message", (e: MessageEvent) => {
    if (e.source !== win) return;
    const data = e.data as Partial<ContentRequest> | null;
    if (data?.source !== CONTENT_SOURCE || data.type !== "request-editor-code") return;
    if (typeof data.requestId !== "string") return;
    post({ type: "editor-code", requestId: data.requestId, ...readEditorCode(win) });
  });
}
