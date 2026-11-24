import {
  CONTENT_SOURCE,
  PAGE_SOURCE,
  pageEventSchema,
  type ContentRequest,
  type EditorCode,
  type PageEvent,
} from "./events";

// Isolated-world side of the page bridge. Validates source, origin and shape of every message.

export function listenToPage(win: Window, handler: (event: PageEvent) => void): () => void {
  const listener = (e: MessageEvent) => {
    if (e.source !== win || e.origin !== win.location.origin) return;
    const data = e.data as { source?: unknown; event?: unknown } | null;
    if (!data || data.source !== PAGE_SOURCE) return;
    const parsed = pageEventSchema.safeParse(data.event);
    if (parsed.success) handler(parsed.data);
  };
  win.addEventListener("message", listener);
  return () => win.removeEventListener("message", listener);
}

/** Ask the MAIN-world script for the current editor contents (code fallback). */
export function requestEditorCode(win: Window, timeoutMs = 1000): Promise<EditorCode | null> {
  const requestId = Math.random().toString(36).slice(2);
  return new Promise((resolve) => {
    const stop = listenToPage(win, (event) => {
      if (event.type === "editor-code" && event.requestId === requestId) {
        stop();
        clearTimeout(timer);
        resolve(event);
      }
    });
    const timer = setTimeout(() => {
      stop();
      resolve(null);
    }, timeoutMs);
    const req: ContentRequest = { source: CONTENT_SOURCE, type: "request-editor-code", requestId };
    win.postMessage(req, win.location.origin);
  });
}
