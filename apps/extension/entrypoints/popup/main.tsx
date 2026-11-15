import { StrictMode, useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { browser } from "wxt/browser";
import { ExternalLink, LayoutDashboard, Settings } from "lucide-react";
import { STATUS_LABELS, formatDuration, type Queue } from "@leettrack/core";
import type { ConfidenceGauge as GaugeData, Countdown } from "@leettrack/insights";
import { Button } from "@leettrack/ui/components/button";
import { Stat } from "@leettrack/ui/components/panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@leettrack/ui/components/tabs";
import { parseProblemUrl } from "@/adapters/leetcode";
import { Logo } from "@/components/Logo";
import { Today } from "@/components/TodayView";
import { followSystemTheme } from "@/components/theme";
import type { SyncStatus } from "@/lib/account";
import { formatAgo, formatDue } from "@/lib/format";
import { call } from "@/lib/messaging";
import type { ProblemState, Stats, TabMessage } from "@/lib/types";
import "@/components/base.css";

followSystemTheme();

type Tab = "today" | "problem" | "stats";

const openDashboard = () =>
  void browser.tabs.create({ url: browser.runtime.getURL("/dashboard.html") });

function Popup() {
  const [tabId, setTabId] = useState<number>();
  const [tab, setTab] = useState<Tab>("today");
  const [problem, setProblem] = useState<ProblemState | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [queue, setQueue] = useState<Queue | null>(null);
  const [gauge, setGauge] = useState<GaugeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [sync, setSync] = useState<SyncStatus | null>(null);
  const [upcoming, setUpcoming] = useState<Countdown[]>([]);

  useEffect(() => {
    (async () => {
      const [current] = await browser.tabs.query({ active: true, currentWindow: true });
      const loc = current?.url ? parseProblemUrl(current.url) : null;
      if (current?.id !== undefined && loc) {
        setTabId(current.id);
        setTab("problem");
        setProblem(await call("getProblemState", loc.slug));
      }
      const [q, s, st, cd, g] = await Promise.all([
        call("getQueue"),
        call("getStats"),
        call("getSyncStatus").catch(() => null),
        call("getCountdowns"),
        call("getGauge"),
      ]);
      setUpcoming(cd);
      setQueue(q);
      setStats(s);
      setSync(st);
      setGauge(g);
    })().catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const openPanel = async () => {
    if (tabId === undefined) return;
    const msg: TabMessage = { kind: "leettrack-tab", type: "open-panel" };
    await browser.tabs.sendMessage(tabId, msg).catch(() => {});
    window.close();
  };

  const last = problem?.attempts.at(-1);
  const reviewCount = queue ? queue.items.filter((i) => i.kind === "review").length : null;

  return (
    <main className="flex w-[360px] flex-col gap-3 p-3">
      <header className="flex items-center justify-between">
        <h1 className="flex items-center gap-2 text-sm font-semibold">
          <Logo /> LeetTrack
        </h1>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={openDashboard}>
            <LayoutDashboard /> Dashboard
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
        </div>
      </header>

      {sync?.configured && (
        <p
          className={`-mt-1 text-xs ${sync.lastError ? "text-bad" : "text-muted-foreground"}`}
          role="status"
        >
          {!sync.signedIn ? (
            <button
              className="text-link hover:underline"
              onClick={() => browser.runtime.openOptionsPage()}
            >
              Not syncing: sign in to back up your attempts
            </button>
          ) : sync.lastError ? (
            "Sync failed: see Settings"
          ) : sync.lastSyncAt ? (
            `Synced ${formatAgo(sync.lastSyncAt)} as ${sync.userName ?? "you"}`
          ) : (
            "Syncing…"
          )}
        </p>
      )}

      {upcoming.length > 0 && (
        <ul className="flex flex-wrap gap-x-3 gap-y-1 text-xs" aria-label="Interviews">
          {upcoming.map((c) => (
            <li key={c.id}>
              <strong className="text-primary tabular-nums">
                {c.daysLeft === 0 ? "Today" : `${c.daysLeft}d`}
              </strong>{" "}
              {c.label}
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-bad">{error}</p>}

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)} className="gap-3">
        <TabsList className="w-full">
          <TabsTrigger value="today">
            Today{reviewCount !== null ? ` (${reviewCount})` : ""}
          </TabsTrigger>
          {tabId !== undefined && <TabsTrigger value="problem">This problem</TabsTrigger>}
          <TabsTrigger value="stats">Stats</TabsTrigger>
        </TabsList>

        <TabsContent value="today">
          <Today queue={queue} gauge={gauge} onQueue={setQueue} />
        </TabsContent>

        {problem && (
          <TabsContent value="problem">
            <section className="flex flex-col gap-2 rounded-xl bg-card p-3 ring-1 ring-foreground/10">
              <p className="font-medium">
                {problem.problem?.frontendId ? `${problem.problem.frontendId}. ` : ""}
                {problem.problem?.title ?? problem.slug}
              </p>
              <p className="text-xs text-muted-foreground">
                {STATUS_LABELS[problem.status.status]}
                {problem.status.overridden ? " (manual)" : ""} · {problem.attempts.length} attempt
                {problem.attempts.length === 1 ? "" : "s"}
                {last &&
                  ` · last ${new Date(last.startedAt).toLocaleDateString()} (${formatDuration(last.activeSeconds)})`}
              </p>
              {problem.card && (
                <p className="text-xs text-muted-foreground">
                  Next review {formatDue(problem.card.due)}
                  {problem.card.forTarget && ` (before ${problem.card.forTarget})`}
                  {problem.card.isLeech && " · leech"}
                </p>
              )}
              <Button onClick={() => void openPanel()}>
                <ExternalLink /> Open log panel
              </Button>
            </section>
          </TabsContent>
        )}

        <TabsContent value="stats">
          {stats && (
            <section className="grid grid-cols-2 gap-4 rounded-xl bg-card p-3 ring-1 ring-foreground/10">
              <Stat value={stats.problemsAttempted} label="problems attempted" />
              <Stat value={stats.fullySolved} label="fully solved" />
              <Stat value={stats.attempts} label="attempts logged" />
              <Stat value={stats.dueToday} label="reviews today" />
              <Stat value={stats.leeches} label="leeches" />
            </section>
          )}
        </TabsContent>
      </Tabs>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Popup />
  </StrictMode>,
);
