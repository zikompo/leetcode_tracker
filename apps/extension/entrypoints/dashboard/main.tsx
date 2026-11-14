import { StrictMode, useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { browser } from "wxt/browser";
import {
  MASTERY_LABELS,
  STATUS_LABELS,
  type PatternMastery,
  type ProblemStatus,
  type Settings,
} from "@leettrack/core";
import { problemUrl } from "@/adapters/leetcode";
import { call } from "@/lib/messaging";
import { allPatterns, patternName } from "@/lib/patterns";
import type { Dashboard as DashboardData, ListProgress } from "@/lib/types";
import "@/components/base.css";
import "./dashboard.css";

type Tab = "patterns" | "lists" | "leeches";
const pct = (x: number | undefined) => (x === undefined ? "–" : `${Math.round(x * 100)}%`);
const STATUS_ORDER: ProblemStatus[] = [
  "mastered",
  "fully_solved",
  "solved_with_help",
  "in_progress",
  "unseen",
];

function breakdown(m: PatternMastery): string {
  return [
    `Mastery ${pct(m.mastery)} = 50% retention + 30% cold-solve + 20% coverage`,
    `Retention ${pct(m.retention)}: how well you'd recall the ${m.attempted} problem(s) you've done, weighted by difficulty and how cleanly you solved them`,
    `Cold-solve ${pct(m.coldSolve)}: ${m.coldSolved} of ${m.coldAttempts} first attempts solved alone (smoothed)`,
    m.coverage === undefined
      ? "Coverage: not in your active lists, so not counted"
      : `Coverage ${pct(m.coverage)} of ${m.listTotal} problems in your active lists`,
  ].join("\n");
}

function PatternsTab({
  data,
  settings,
  onSettings,
}: {
  data: DashboardData;
  settings: Settings;
  onSettings(): void;
}) {
  const name = (id: string) => patternName(id, settings);
  const rows = [...data.patterns].sort(
    (a, b) => Number(b.attempted > 0) - Number(a.attempted > 0) || b.mastery - a.mastery,
  );
  return (
    <>
      <div className="insights">
        <section className="card">
          <h2>Weakest patterns</h2>
          {data.insights.weakest.length === 0 ? (
            <p className="muted">Log a few attempts to see where you're weakest.</p>
          ) : (
            <ol>
              {data.insights.weakest.map((m) => (
                <li key={m.pattern}>
                  {name(m.pattern)} <span className="muted">· {pct(m.mastery)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>
        <section className="card">
          <h2>Can re-solve, hard to spot fresh</h2>
          {data.insights.retentionColdGap.length === 0 ? (
            <p className="muted">No big gaps between retention and cold-solve yet.</p>
          ) : (
            <ul>
              {data.insights.retentionColdGap.map((m) => (
                <li key={m.pattern}>
                  {name(m.pattern)}{" "}
                  <span className="muted">
                    · retention {pct(m.retention)}, cold {pct(m.coldSolve)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <table className="mastery">
        <thead>
          <tr>
            <th>Pattern</th>
            <th>Level</th>
            <th>Mastery</th>
            <th title="Retention">R</th>
            <th title="Cold-solve">C</th>
            <th title="Coverage of active lists">V</th>
            <th>Done</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((m) => (
            <tr key={m.pattern} title={breakdown(m)}>
              <td>{name(m.pattern)}</td>
              <td>
                <span className={`level level-${m.level}`}>{MASTERY_LABELS[m.level]}</span>
              </td>
              <td>
                <div className="bar" aria-label={`Mastery ${pct(m.mastery)}`}>
                  <div style={{ width: pct(m.attempted ? m.mastery : 0) }} />
                </div>
              </td>
              <td>{m.attempted ? pct(m.retention) : "–"}</td>
              <td>{m.attempted ? pct(m.coldSolve) : "–"}</td>
              <td>{pct(m.coverage)}</td>
              <td>
                {m.attempted}
                {m.listTotal ? `/${m.listTotal}` : ""}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <p className="muted small">Hover a row to see how its score is made up.</p>

      <ManageTags settings={settings} onDone={onSettings} />
    </>
  );
}

function ManageTags({ settings, onDone }: { settings: Settings; onDone(): void }) {
  const patterns = allPatterns(settings);
  const [renameId, setRenameId] = useState(patterns[0]?.id ?? "");
  const [newName, setNewName] = useState("");
  const [from, setFrom] = useState("");
  const [into, setInto] = useState("");
  const [message, setMessage] = useState<{ kind: "ok" | "bad"; text: string } | null>(null);
  const run = async (fn: () => Promise<unknown>, text: string) => {
    try {
      await fn();
      setMessage({ kind: "ok", text });
      onDone();
    } catch (e) {
      setMessage({ kind: "bad", text: e instanceof Error ? e.message : String(e) });
    }
  };
  const select = (value: string, set: (v: string) => void, label: string) => (
    <select value={value} onChange={(e) => set(e.target.value)} aria-label={label}>
      <option value="">Choose…</option>
      {patterns.map((p) => (
        <option key={p.id} value={p.id}>
          {p.name}
        </option>
      ))}
    </select>
  );
  return (
    <section className="card manage">
      <h2>Manage pattern tags</h2>
      <div className="row">
        {select(renameId, setRenameId, "Pattern to rename")}
        <input
          placeholder="New name"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          aria-label="New name"
        />
        <button
          className="btn"
          disabled={!renameId || !newName.trim()}
          onClick={() =>
            void run(() => call("renamePattern", { id: renameId, name: newName }), "Renamed.").then(
              () => setNewName(""),
            )
          }
        >
          Rename
        </button>
      </div>
      <div className="row">
        <span>Merge</span>
        {select(from, setFrom, "Pattern to merge")}
        <span>into</span>
        {select(into, setInto, "Pattern to keep")}
        <button
          className="btn"
          disabled={!from || !into}
          onClick={() =>
            void run(
              () => call("mergePattern", { from, into }),
              `Merged. Problems tagged ${patternName(from, settings)} are now ${patternName(into, settings)}.`,
            )
          }
        >
          Merge
        </button>
      </div>
      {message && <p className={message.kind}>{message.text}</p>}
    </section>
  );
}

function ListCard({ list, onToggle }: { list: ListProgress; onToggle(on: boolean): void }) {
  const started = list.total - list.byStatus.unseen;
  return (
    <section className="card list-card">
      <div className="row spread">
        <h2>{list.name}</h2>
        <label className="check">
          <input
            type="checkbox"
            checked={list.active}
            onChange={(e) => onToggle(e.target.checked)}
          />
          Active
        </label>
      </div>
      <p className="muted">
        {started} of {list.total} started · {list.byStatus.fully_solved + list.byStatus.mastered}{" "}
        fully solved
      </p>
      <div className="stack" aria-label={`${list.name} progress`}>
        {STATUS_ORDER.filter((s) => s !== "unseen").map((s) => (
          <div
            key={s}
            className={`seg seg-${s}`}
            style={{ width: `${(list.byStatus[s] / list.total) * 100}%` }}
            title={`${STATUS_LABELS[s]}: ${list.byStatus[s]}`}
          />
        ))}
      </div>
      <ul className="legend">
        {STATUS_ORDER.map((s) => (
          <li key={s}>
            <span className={`dot seg-${s}`} /> {STATUS_LABELS[s]} {list.byStatus[s]}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Dashboard() {
  const [tab, setTab] = useState<Tab>("patterns");
  const [data, setData] = useState<DashboardData | null>(null);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    try {
      const [d, s] = await Promise.all([call("getDashboard"), call("getSettings")]);
      setData(d);
      setSettings(s);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  };
  useEffect(() => {
    void load();
  }, []);

  const toggleList = async (id: string, on: boolean) => {
    if (!settings) return;
    const ids = data?.lists.map((l) => l.id) ?? [];
    await call("setSettings", {
      activeLists: ids.filter((l) => (l === id ? on : settings.activeLists.includes(l))),
    });
    await load();
  };

  return (
    <main className="dash">
      <header className="row spread">
        <h1>LeetTrack dashboard</h1>
        <button className="btn" onClick={() => browser.runtime.openOptionsPage()}>
          Settings
        </button>
      </header>
      <nav className="tabs" role="tablist">
        {(
          [
            ["patterns", "Patterns"],
            ["lists", "Lists"],
            ["leeches", `Leeches${data ? ` (${data.leeches.length})` : ""}`],
          ] as Array<[Tab, string]>
        ).map(([id, label]) => (
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
      {!data || !settings ? (
        <p className="muted">Loading…</p>
      ) : tab === "patterns" ? (
        <PatternsTab data={data} settings={settings} onSettings={() => void load()} />
      ) : tab === "lists" ? (
        <div className="lists">
          {data.lists.map((l) => (
            <ListCard key={l.id} list={l} onToggle={(on) => void toggleList(l.id, on)} />
          ))}
        </div>
      ) : data.leeches.length === 0 ? (
        <p className="muted">
          No leeches. A problem becomes one after being rated Again three times.
        </p>
      ) : (
        <div className="leeches">
          {data.leeches.map((l) => (
            <section key={l.slug} className="card">
              <div className="row spread">
                <a href={problemUrl(l.slug)} target="_blank" rel="noreferrer">
                  {l.title}
                </a>
                <span className="pill pill-bad">Again ×{l.againCount}</span>
              </div>
              {l.stuckNotes.length === 0 ? (
                <p className="muted">No "where I got stuck" notes yet. Add one next attempt.</p>
              ) : (
                <ul className="stuck">
                  {l.stuckNotes.map((n) => (
                    <li key={n.at}>
                      <span className="muted">{new Date(n.at).toLocaleDateString()}</span> {n.note}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          ))}
        </div>
      )}
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Dashboard />
  </StrictMode>,
);
