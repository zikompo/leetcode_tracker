import { StrictMode, useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { browser } from "wxt/browser";
import { ExternalLink, LayoutDashboard, Settings } from "lucide-react";
import { STATUS_LABELS, formatDuration, type Queue, type QueueItem } from "@leettrack/core";
import type { ConfidenceGauge as GaugeData, Countdown } from "@leettrack/insights";
import { Badge } from "@leettrack/ui/components/badge";
import { Button } from "@leettrack/ui/components/button";
import { ConfidenceGauge } from "@leettrack/ui/components/confidence-gauge";
import { Difficulty, Stat } from "@leettrack/ui/components/panel";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@leettrack/ui/components/tabs";
import { parseProblemUrl, problemUrl } from "@/adapters/leetcode";
import { Logo } from "@/components/Logo";
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

function QueueRow({ item }: { item: QueueItem }) {
  const marker =
    item.kind === "new"
      ? "new"
      : item.overdueDays > 0
        ? `overdue ${item.overdueDays}d`
        : "due today";
  return (
    <li>
      <button
        className="queue-row flex w-full flex-col gap-1 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-accent"
        onClick={() => void browser.tabs.create({ url: problemUrl(item.slug) })}
        title={item.kind === "review" && item.due ? `Due ${formatDue(item.due)}` : undefined}
      >
        <span className="truncate text-sm">
          {item.frontendId ? `${item.frontendId}. ` : ""}
          {item.title ?? item.slug}
        </span>
        <span className="flex flex-wrap items-center gap-1.5">
          {item.difficulty && <Difficulty value={item.difficulty} />}
          <Badge variant={item.kind === "new" ? "secondary" : "outline"} className="text-[11px]">
            {marker}
          </Badge>
          {item.forTarget && (
            <Badge
              className="bg-warn/15 text-[11px] text-warn"
              title="An extra review before this interview"
            >
              before {item.forTarget.label}
            </Badge>
          )}
          {item.quickEligible && (
            <Badge variant="outline" className="text-[11px]">
              quick
            </Badge>
          )}
          {item.isLeech && (
            <Badge variant="destructive" className="text-[11px]">
              leech
            </Badge>
          )}
        </span>
      </button>
    </li>
  );
}

function Section({
  label,
  count,
  children,
}: {
  label: string;
  count: number;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={label} className="flex flex-col gap-1">
      <h2 className="flex items-center gap-2 px-2 text-xs font-medium text-muted-foreground">
        {label === "New problems" ? "New" : label}
        <span className="rounded-full bg-secondary px-1.5 text-[11px] tabular-nums">{count}</span>
      </h2>
      {children}
    </section>
  );
}

function Today({ queue, gauge }: { queue: Queue | null; gauge: GaugeData | null }) {
  if (!queue) return <p className="text-muted-foreground">Loading…</p>;
  const reviews = queue.items.filter((i) => i.kind === "review");
  const fresh = queue.items.filter((i) => i.kind === "new");
  const capped = queue.reviewsDue - reviews.length;
  return (
    <div className="flex flex-col gap-3">
      {gauge && gauge.tracked > 0 && (
        <div className="flex justify-center">
          <ConfidenceGauge {...gauge} compact />
        </div>
      )}
      <Section label="Reviews" count={reviews.length}>
        {reviews.length === 0 ? (
          <p className="px-2 text-muted-foreground">
            Nothing due. {queue.reviewsDoneToday > 0 && "All done for today."}
          </p>
        ) : (
          <ol className="flex flex-col">
            {reviews.map((i) => (
              <QueueRow key={i.slug} item={i} />
            ))}
          </ol>
        )}
        {capped > 0 && (
          <p className="px-2 text-xs text-muted-foreground">
            {capped} more due, held back by your daily limit.
          </p>
        )}
      </Section>
      <Section label="New problems" count={fresh.length}>
        {fresh.length === 0 ? (
          <p className="px-2 text-muted-foreground">
            {queue.noNewFor
              ? `None today: ${queue.noNewFor.label} is close, so it's reviews only.`
              : queue.newDoneToday > 0
                ? "You've started today's new problems."
                : "No new problems: pick an active list in settings."}
          </p>
        ) : (
          <ol className="flex flex-col">
            {fresh.map((i) => (
              <QueueRow key={i.slug} item={i} />
            ))}
          </ol>
        )}
      </Section>
    </div>
  );
}

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
          <Today queue={queue} gauge={gauge} />
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
