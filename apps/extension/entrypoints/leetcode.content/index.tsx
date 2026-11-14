import ReactDOM from "react-dom/client";
import { browser } from "wxt/browser";
import { LEETCODE_MATCHES } from "@/adapters/leetcode";
import type { TabMessage } from "@/lib/types";
import { App } from "./App";
import { PageController } from "./controller";
import "./panel.css";

export default defineContentScript({
  matches: LEETCODE_MATCHES,
  cssInjectionMode: "ui",
  async main(ctx) {
    const controller = new PageController(window);
    ctx.addEventListener(window, "wxt:locationchange", ({ newUrl }) => {
      void controller.onLocationChange(newUrl.href);
    });
    ctx.onInvalidated(() => controller.stop());

    browser.runtime.onMessage.addListener((message: unknown) => {
      const m = message as Partial<TabMessage> | null;
      if (m?.kind === "leettrack-tab" && m.type === "open-panel") controller.setPanelOpen(true);
    });

    const ui = await createShadowRootUi(ctx, {
      name: "leettrack-panel",
      position: "inline",
      anchor: "body",
      append: "last",
      isolateEvents: true, // keep LeetCode's keyboard shortcuts out of our inputs
      onMount(container) {
        const root = ReactDOM.createRoot(container);
        root.render(<App controller={controller} />);
        return root;
      },
      onRemove(root) {
        root?.unmount();
      },
    });
    ui.mount();
    await controller.start();
  },
});
