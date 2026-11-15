import { DEFAULT_SETTINGS } from "@leettrack/core";
import { browser } from "wxt/browser";
import type { PageState } from "../leetcode.content/controller";
import {
  PANEL_ACTIONS,
  PANEL_PORT,
  type PageToPanel,
  type PanelAction,
  type PanelController,
} from "../leetcode.content/panel-controller";

/**
 * A PanelController that lives in the side panel and drives the one in a LeetCode tab: it
 * mirrors the tab's state and forwards each action over a port.
 */
export function connectRemotePanel(
  tabId: number,
  onClose: () => void,
): (PanelController & { close(): void }) | null {
  let port: ReturnType<typeof browser.tabs.connect>;
  try {
    port = browser.tabs.connect(tabId, { name: PANEL_PORT });
  } catch {
    return null;
  }
  let state: PageState | null = null;
  const listeners = new Set<() => void>();
  const pending = new Map<number, { resolve(v: unknown): void; reject(e: Error): void }>();
  let nextId = 1;

  port.onMessage.addListener((raw: unknown) => {
    const msg = raw as PageToPanel;
    if (msg.type === "state") {
      state = msg.state;
      listeners.forEach((l) => l());
    } else if (msg.type === "result") {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) p?.reject(new Error(msg.error));
      else p?.resolve(msg.value);
    }
  });
  port.onDisconnect.addListener(() => {
    pending.forEach((p) => p.reject(new Error("The LeetCode tab went away.")));
    pending.clear();
    onClose();
  });

  const callRemote = (method: PanelAction, args: unknown[]) =>
    new Promise<unknown>((resolve, reject) => {
      const id = nextId++;
      pending.set(id, { resolve, reject });
      port.postMessage({ type: "call", id, method, args });
    });

  const actions = Object.fromEntries(
    PANEL_ACTIONS.map((m) => [m, (...args: unknown[]) => callRemote(m, args)]),
  ) as unknown as Omit<PanelController, "subscribe" | "getSnapshot">;

  return {
    ...actions,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    getSnapshot() {
      // Until the first state arrives the panel renders nothing (loc is null).
      return state ?? EMPTY;
    },
    close() {
      port.disconnect();
    },
  };
}

const EMPTY = {
  loc: null,
  problem: null,
  session: null,
  settings: DEFAULT_SETTINGS,
  ai: { enabled: false },
  analyzing: [],
  panelOpen: true,
  lastResult: null,
  formKey: 0,
  saving: false,
  error: null,
} satisfies PageState;
