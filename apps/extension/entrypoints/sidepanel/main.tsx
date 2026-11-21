import { StrictMode, useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { browser } from "wxt/browser";
import { LayoutDashboard, Settings } from "lucide-react";
import type { Queue } from "@leettrack/core";
import type { ConfidenceGauge as GaugeData } from "@leettrack/insights";
import { Button } from "@leettrack/ui/components/button";
import { parseProblemUrl } from "@/adapters/leetcode";
import { Logo } from "@/components/Logo";
import { Today } from "@/components/TodayView";
import { followSystemTheme } from "@/components/theme";
import { loadPanelFonts } from "@/lib/fonts";
import { call } from "@/lib/messaging";
import { openWebsite } from "@/lib/website";
import { App } from "../leetcode.content/App";
import { connectRemotePanel } from "./remote";
import "@/components/base.css";
import "../leetcode.content/panel.css";

followSystemTheme();
loadPanelFonts();

type Remote = NonNullable<ReturnType<typeof connectRemotePanel>>;

/**
 * The tab the side panel follows: the active tab in this window, or (for tests) the one named
 * by ?tab=.
 */
function useFollowedTab() {
  const forced = Number(new URLSearchParams(location.search).get("tab")) || undefined;
  const [tab, setTab] = useState<{ id: number; url: string } | null>(null);
  useEffect(() => {
    let live = true;
    const read = async () => {
      const t = forced
        ? await browser.tabs.get(forced).catch(() => undefined)
        : (await browser.tabs.query({ active: true, currentWindow: true }))[0];
      if (live) setTab(t?.id !== undefined ? { id: t.id, url: t.url ?? "" } : null);
    };
    void read();
    const onActivated = () => void read();
    const onUpdated = (id: number, change: { url?: string; status?: string }) => {
      if ((change.url || change.status === "complete") && (!forced || id === forced)) void read();
    };
    browser.tabs.onActivated.addListener(onActivated);
    browser.tabs.onUpdated.addListener(onUpdated);
    return () => {
      live = false;
      browser.tabs.onActivated.removeListener(onActivated);
      browser.tabs.onUpdated.removeListener(onUpdated);
    };
  }, [forced]);
  return tab;
}

/** Connect to the LeetCode tab's panel; retry briefly while its page is still loading. */
function useRemotePanel(tabId: number | undefined, slug: string | undefined) {
  const [remote, setRemote] = useState<Remote | null>(null);
  useEffect(() => {
    if (tabId === undefined || !slug) return;
    let current: Remote | null = null;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let tries = 0;
    let gone = false;
    const connect = () => {
      current = connectRemotePanel(tabId, () => {
        setRemote(null);
        if (!gone && tries++ < 10) retry = setTimeout(connect, 500);
      });
      setRemote(current);
    };
    connect();
    return () => {
      gone = true;
      clearTimeout(retry);
      current?.close();
      setRemote(null);
    };
  }, [tabId, slug]);
  return remote;
}

function TodayHere() {
  const [queue, setQueue] = useState<Queue | null>(null);
  const [gauge, setGauge] = useState<GaugeData | null>(null);
  useEffect(() => {
    void Promise.all([call("getQueue"), call("getGauge")]).then(([q, g]) => {
      setQueue(q);
      setGauge(g);
    });
  }, []);
  return (
    <div className="flex flex-col gap-3 p-3">
      <p className="text-xs text-muted-foreground">
        Open a LeetCode problem and the log panel appears here.
      </p>
      <Today queue={queue} gauge={gauge} onQueue={setQueue} />
    </div>
  );
}

function SidePanel() {
  const tab = useFollowedTab();
  const slug = tab ? parseProblemUrl(tab.url)?.slug : undefined;
  const remote = useRemotePanel(tab?.id, slug);
  return (
    <main className="flex h-dvh flex-col">
      <header className="flex items-center justify-between border-b px-3 py-2">
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Logo /> LeetTrack
        </span>
        <span className="flex gap-1">
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Dashboard"
            title="Dashboard"
            onClick={() => openWebsite()}
          >
            <LayoutDashboard />
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Settings"
            title="Settings"
            onClick={() => browser.runtime.openOptionsPage()}
          >
            <Settings />
          </Button>
        </span>
      </header>
      <div className="min-h-0 flex-1">
        {slug && remote ? <App controller={remote} layout="side" /> : <TodayHere />}
      </div>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <SidePanel />
  </StrictMode>,
);
