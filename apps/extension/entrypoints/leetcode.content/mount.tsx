import ReactDOM from "react-dom/client";
import type { ContentScriptContext } from "wxt/utils/content-script-context";
import { browser } from "wxt/browser";
import type { Site } from "@/adapters/sites";
import { loadPanelFonts } from "@/lib/fonts";
import type { TabMessage } from "@/lib/types";
import { App } from "./App";
import { PageController } from "./controller";
import { servePanel } from "./panel-controller";
import "./panel.css";

/** The log panel on a problem page: the same panel on every site, driven by its adapter. */
export async function mountPanel(ctx: ContentScriptContext, site: Site) {
  const controller = new PageController(window, site);
  ctx.addEventListener(window, "wxt:locationchange", ({ newUrl }) => {
    void controller.onLocationChange(newUrl.href);
  });
  const stopServing = servePanel(controller);
  ctx.onInvalidated(() => {
    stopServing();
    controller.stop();
  });

  browser.runtime.onMessage.addListener((message: unknown) => {
    const m = message as Partial<TabMessage> | null;
    if (m?.kind === "leettrack-tab" && m.type === "open-panel") controller.setPanelOpen(true);
  });

  loadPanelFonts();
  const ui = await createShadowRootUi(ctx, {
    name: "leettrack-panel",
    position: "inline",
    anchor: "body",
    append: "last",
    isolateEvents: true, // keep the site's keyboard shortcuts out of our inputs
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
}
