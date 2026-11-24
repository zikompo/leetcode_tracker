// MAIN world only. Wraps fetch and XMLHttpRequest so a site adapter can see the requests it
// cares about (the user's own submissions) and their responses. The page's requests always go
// through unchanged: errors in the watcher are swallowed, never thrown into the page.

export type ExchangeHandler = (
  url: string,
  method: string,
  requestBody: unknown,
  responseBody: unknown,
) => void;

const safeJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return undefined;
  }
};

/**
 * Call `onExchange` with the request and JSON response of every request `isInteresting` picks.
 * Request bodies are passed as sent (usually a JSON string); responses are parsed JSON.
 */
export function watchRequests(
  win: Window & typeof globalThis,
  isInteresting: (url: string, method: string) => boolean,
  onExchange: ExchangeHandler,
) {
  // --- fetch ---
  const originalFetch = win.fetch;
  win.fetch = async function (input: RequestInfo | URL, init?: RequestInit) {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const method = (
      init?.method ?? (input instanceof Request ? input.method : "GET")
    ).toUpperCase();
    const interesting = isInteresting(url, method);
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
          onExchange(url, method, reqBody, safeJson(text));
        } catch {
          /* never break the page */
        }
      })();
    }
    return response;
  } as typeof fetch;

  // --- XMLHttpRequest ---
  const XHR = win.XMLHttpRequest;
  if (!XHR) return;
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
    if (m && isInteresting(m.url, m.method)) {
      this.addEventListener("load", () => {
        try {
          const res =
            this.responseType === "json"
              ? this.response
              : this.responseType === "" || this.responseType === "text"
                ? safeJson(this.responseText)
                : undefined;
          onExchange(m.url, m.method, body, res);
        } catch {
          /* never break the page */
        }
      });
    }
    return originalSend.call(this, body);
  };
}
