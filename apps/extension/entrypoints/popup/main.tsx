import { StrictMode, useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { browser } from "wxt/browser";
import { STATUS_LABELS, formatDuration, type Queue, type QueueItem } from "@leettrack/core";
import { parseProblemUrl, problemUrl } from "@/adapters/leetcode";
import { formatDue } from "@/lib/format";
import { call } from "@/lib/messaging";
import type { ProblemState, Stats, TabMessage } from "@/lib/types";
import "@/components/base.css";
import "./popup.css";

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
        className="queue-row"
        onClick={() => void browser.tabs.create({ url: problemUrl(item.slug) })}
        title={item.kind === "review" && item.due ? `Due ${formatDue(item.due)}` : undefined}
      >
        <span className="queue-title">
          {item.frontendId ? `${item.frontendId}. ` : ""}
          {item.title ?? item.slug}
        </span>
        <span className="queue-tags">
          {item.difficulty && (
            <span className={`pill diff-${item.difficulty.toLowerCase()}`}>{item.difficulty}</span>
          )}
          <span className={`pill ${item.kind === "new" ? "pill-new" : "pill-due"}`}>{marker}</span>
          {item.quickEligible && <span className="pill">quick</span>}
          {item.isLeech && <span className="pill pill-bad">leech</span>}
        </span>
      </button>
    </li>
  );
}

function Today({ queue }: { queue: Queue | null }) {
  if (!queue) return <p className="muted">Loading…</p>;
  const reviews = queue.items.filter((i) => i.kind === "review");
  const fresh = queue.items.filter((i) => i.kind === "new");
  const capped = queue.reviewsDue - reviews.length;
  return (
    <>
      <section aria-label="Reviews">
        <h2>
          Reviews <span className="count">{reviews.length}</span>
        </h2>
        {reviews.length === 0 ? (
          <p className="muted">
            Nothing due. {queue.reviewsDoneToday > 0 && "All done for today."}
          </p>
        ) : (
          <ol className="queue">
            {reviews.map((i) => (
              <QueueRow key={i.slug} item={i} />
            ))}
          </ol>
        )}
        {capped > 0 && (
          <p className="muted small">{capped} more due, held back by your daily limit.</p>
        )}
      </section>
      <section aria-label="New problems">
        <h2>
          New <span className="count">{fresh.length}</span>
        </h2>
        {fresh.length === 0 ? (
          <p className="muted">
            {queue.newDoneToday > 0
              ? "You've started today's new problems."
              : "No new problems: pick an active list in settings."}
          </p>
        ) : (
          <ol className="queue">
            {fresh.map((i) => (
              <QueueRow key={i.slug} item={i} />
            ))}
          </ol>
        )}
      </section>
    </>
  );
}

function Popup() {
  const [tabId, setTabId] = useState<number>();
  const [tab, setTab] = useState<Tab>("today");
  const [problem, setProblem] = useState<ProblemState | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [queue, setQueue] = useState<Queue | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [current] = await browser.tabs.query({ active: true, currentWindow: true });
      const loc = current?.url ? parseProblemUrl(current.url) : null;
      if (current?.id !== undefined && loc) {
        setTabId(current.id);
        setTab("problem");
        setProblem(await call("getProblemState", loc.slug));
      }
      const [q, s] = await Promise.all([call("getQueue"), call("getStats")]);
      setQueue(q);
      setStats(s);
    })().catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)));
  }, []);

  const openPanel = async () => {
    if (tabId === undefined) return;
    const msg: TabMessage = { kind: "leettrack-tab", type: "open-panel" };
    await browser.tabs.sendMessage(tabId, msg).catch(() => {});
    window.close();
  };

  const last = problem?.attempts.at(-1);
  const tabs: Array<[Tab, string]> = [
    ["today", `Today${queue ? ` (${queue.items.filter((i) => i.kind === "review").length})` : ""}`],
    ...(tabId !== undefined ? [["problem", "This problem"] as [Tab, string]] : []),
    ["stats", "Stats"],
  ];

  return (
    <main className="popup">
      <header className="popup-head">
        <h1>LeetTrack</h1>
        <div className="row">
          <button className="btn" onClick={openDashboard}>
            Dashboard
          </button>
          <button className="btn" onClick={() => browser.runtime.openOptionsPage()}>
            Settings
          </button>
        </div>
      </header>

      <nav className="tabs" role="tablist">
        {tabs.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            className="tab"
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </nav>

      {error && <p className="bad">{error}</p>}

      {tab === "today" && <Today queue={queue} />}

      {tab === "problem" && problem && (
        <section className="card">
          <p className="popup-title">
            {problem.problem?.frontendId ? `${problem.problem.frontendId}. ` : ""}
            {problem.problem?.title ?? problem.slug}
          </p>
          <p className="muted">
            {STATUS_LABELS[problem.status.status]}
            {problem.status.overridden ? " (manual)" : ""} · {problem.attempts.length} attempt
            {problem.attempts.length === 1 ? "" : "s"}
            {last &&
              ` · last ${new Date(last.startedAt).toLocaleDateString()} (${formatDuration(last.activeSeconds)})`}
          </p>
          {problem.card && (
            <p className="muted">
              Next review {formatDue(problem.card.due)}
              {problem.card.isLeech && " · leech"}
            </p>
          )}
          <button className="btn btn-primary" onClick={openPanel}>
            Open log panel
          </button>
        </section>
      )}

      {tab === "stats" && stats && (
        <section className="stats">
          <div className="stat card">
            <strong>{stats.problemsAttempted}</strong>
            <span>problems attempted</span>
          </div>
          <div className="stat card">
            <strong>{stats.fullySolved}</strong>
            <span>fully solved</span>
          </div>
          <div className="stat card">
            <strong>{stats.attempts}</strong>
            <span>attempts logged</span>
          </div>
          <div className="stat card">
            <strong>{stats.dueToday}</strong>
            <span>reviews today</span>
          </div>
          <div className="stat card">
            <strong>{stats.leeches}</strong>
            <span>leeches</span>
          </div>
        </section>
      )}
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Popup />
  </StrictMode>,
);
