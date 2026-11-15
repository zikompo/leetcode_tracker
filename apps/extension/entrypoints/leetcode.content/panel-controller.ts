import type { AttemptDraft, HelpLevel, StatusOverride } from "@leettrack/core";
import { browser } from "wxt/browser";
import type { PageState } from "./controller";
import type { QuickReviewInput } from "./QuickReview";

/**
 * What the panel UI needs from its controller. The floating panel uses the page's own
 * PageController; the side panel uses a remote copy that talks to it over a port (spec 4.3:
 * the same panel, also available in Chrome's side panel).
 */
export interface PanelController {
  subscribe(listener: () => void): () => void;
  getSnapshot(): PageState;
  setPanelOpen(open: boolean): void;
  setTimerRunning(running: boolean): void;
  startNewAttempt(): void;
  removeCheckpoint(index: number): void;
  analyzeCheckpoint(at: string): Promise<void>;
  addCustomPattern(name: string): Promise<string | null>;
  saveAttempt(draft: AttemptDraft): Promise<void>;
  saveQuickReview(input: QuickReviewInput): Promise<void>;
  setStatusOverride(override: StatusOverride | null): Promise<void>;
  takeHelp(level: Exclude<HelpLevel, "none">): void;
  dismissNudge(): void;
  generateTwists(): Promise<void>;
  setTwists(twists: string[]): Promise<void>;
}

export type PanelAction = Exclude<keyof PanelController, "subscribe" | "getSnapshot">;

/** The actions a remote panel may call; anything else is ignored. */
export const PANEL_ACTIONS: readonly PanelAction[] = [
  "setPanelOpen",
  "setTimerRunning",
  "startNewAttempt",
  "removeCheckpoint",
  "analyzeCheckpoint",
  "addCustomPattern",
  "saveAttempt",
  "saveQuickReview",
  "setStatusOverride",
  "takeHelp",
  "dismissNudge",
  "generateTwists",
  "setTwists",
];

export const PANEL_PORT = "leettrack-panel";

export type PanelToPage = { type: "call"; id: number; method: PanelAction; args: unknown[] };
export type PageToPanel =
  | { type: "state"; state: PageState }
  | { type: "result"; id: number; value?: unknown; error?: string };

/**
 * Serve the page's controller to the side panel: push every state change down the port and run
 * the actions it sends. Several side panels (one per window) can connect at once.
 */
export function servePanel(controller: PanelController): () => void {
  const onConnect = (port: ReturnType<typeof browser.runtime.connect>) => {
    if (port.name !== PANEL_PORT) return;
    let open = true;
    const send = (msg: PageToPanel) => {
      if (!open) return;
      try {
        port.postMessage(msg);
      } catch {
        open = false;
      }
    };
    send({ type: "state", state: controller.getSnapshot() });
    const unsubscribe = controller.subscribe(() =>
      send({ type: "state", state: controller.getSnapshot() }),
    );
    port.onMessage.addListener((raw: unknown) => {
      const msg = raw as Partial<PanelToPage>;
      if (msg.type !== "call" || !msg.method || !PANEL_ACTIONS.includes(msg.method)) return;
      const fn = controller[msg.method] as (...a: unknown[]) => unknown;
      Promise.resolve()
        .then(() => fn.apply(controller, Array.isArray(msg.args) ? msg.args : []))
        .then(
          (value) => send({ type: "result", id: msg.id ?? 0, value }),
          (err: unknown) =>
            send({
              type: "result",
              id: msg.id ?? 0,
              error: err instanceof Error ? err.message : String(err),
            }),
        );
    });
    port.onDisconnect.addListener(() => {
      open = false;
      unsubscribe();
    });
  };
  browser.runtime.onConnect.addListener(onConnect);
  return () => browser.runtime.onConnect.removeListener(onConnect);
}
