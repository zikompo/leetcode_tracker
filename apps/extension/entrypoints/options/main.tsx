import { StrictMode, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import type { PanelAutoOpen, Settings } from "@leettrack/core";
import { call } from "@/lib/messaging";
import type { ImportSummary, Stats } from "@/lib/types";
import { AccountSettings } from "./AccountSettings";
import { GitHubSettings } from "./GitHubSettings";
import { AiSettings } from "./AiSettings";
import { InterviewSettings } from "./InterviewSettings";
import { ReviewSettings } from "./ReviewSettings";
import { browser } from "wxt/browser";
import { Logo } from "@/components/Logo";
import { followSystemTheme } from "@/components/theme";
import "@/components/base.css";
import "./options.css";

followSystemTheme();

const AUTO_OPEN: Array<[PanelAutoOpen, string, string]> = [
  ["accepted", "On Accepted", "Open the log panel when a submission is accepted."],
  ["every_submission", "On every submission", "Open it after any result, including Wrong Answer."],
  ["manual", "Only manually", "Open it yourself from the floating button or the toolbar."],
];

const plural = (n: number, one: string) => `${n} ${one}${n === 1 ? "" : "s"}`;

/** What an import brought in, in words. */
function importMessage(r: ImportSummary): string {
  if (r.fromTracker) {
    const parts = [
      plural(r.attemptsAdded, "attempt"),
      r.problemsMerged ? plural(r.problemsMerged, "solved-before problem") : "",
      r.mocksMerged ? plural(r.mocksMerged, "mock interview") : "",
      r.interviewsAdded ? plural(r.interviewsAdded, "interview date") : "",
    ].filter(Boolean);
    return `Imported from your prep tracker: ${parts.join(", ")}. Redo dates are estimated from the tracker's schedule.`;
  }
  return `Imported: ${r.attemptsAdded} new attempts, ${r.attemptsUpdated} updated, ${r.problemsMerged} problems merged${r.mocksMerged ? `, ${plural(r.mocksMerged, "mock interview")}` : ""}.`;
}

const PANEL_STYLES: Array<["floating" | "side", string, string]> = [
  ["floating", "On the LeetCode page", "A small panel you can drag around, over the problem."],
  [
    "side",
    "In Chrome's side panel",
    "Beside the page, out of the way. The toolbar icon opens it; after a result the page offers a button to open it.",
  ],
];

function Options() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [message, setMessage] = useState<{ kind: "ok" | "bad"; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    setSettings(await call("getSettings"));
    setStats(await call("getStats"));
  };
  useEffect(() => {
    void refresh();
  }, []);

  const exportData = async () => {
    const json = await call("exportData");
    const url = URL.createObjectURL(new Blob([json], { type: "application/json" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `leettrack-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importData = async (file: File) => {
    try {
      const r = await call("importData", await file.text());
      setMessage({
        kind: "ok",
        text: importMessage(r),
      });
      await refresh();
    } catch (e) {
      setMessage({ kind: "bad", text: e instanceof Error ? e.message : String(e) });
    } finally {
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <main className="options">
      <header className="row spread">
        <h1>
          <Logo className="size-7" /> LeetTrack settings
        </h1>
        <button
          className="btn"
          onClick={() =>
            void browser.tabs.create({ url: browser.runtime.getURL("/dashboard.html") })
          }
        >
          Open dashboard
        </button>
      </header>

      <section className="card" aria-labelledby="panel-style-heading">
        <h2 id="panel-style-heading">Where should the log panel be?</h2>
        <div className="radios" role="radiogroup" aria-labelledby="panel-style-heading">
          {PANEL_STYLES.map(([value, label, hint]) => (
            <label key={value} className="radio">
              <input
                type="radio"
                name="panelStyle"
                checked={(settings?.panelStyle ?? "floating") === value}
                onChange={async () => setSettings(await call("setSettings", { panelStyle: value }))}
              />
              <span>
                <strong className="font-medium">{label}</strong>
                <span className="muted small">{hint}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="card" aria-labelledby="auto-open-heading">
        <h2 id="auto-open-heading">When should the log panel open?</h2>
        <div className="radios" role="radiogroup">
          {AUTO_OPEN.map(([value, label, hint]) => (
            <label key={value} className="radio">
              <input
                type="radio"
                name="autoOpen"
                checked={settings?.panelAutoOpen === value}
                onChange={async () =>
                  setSettings(await call("setSettings", { panelAutoOpen: value }))
                }
              />
              <span>
                <strong className="font-medium">{label}</strong>
                <span className="muted small">{hint}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <AccountSettings />

      {settings && <ReviewSettings settings={settings} onChange={setSettings} />}
      {settings && <InterviewSettings settings={settings} onChange={setSettings} />}

      <GitHubSettings />

      <AiSettings />

      <section className="card" aria-labelledby="data-heading">
        <h2 id="data-heading">Your data</h2>
        <p className="muted">
          Everything is stored locally in this browser.
          {stats && ` ${stats.attempts} attempts across ${stats.problemsAttempted} problems.`}
        </p>
        <div className="row">
          <button className="btn btn-primary" onClick={exportData}>
            Export JSON
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()}>
            Import JSON
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void importData(f);
            }}
          />
        </div>
        <p className="muted small">
          Importing merges with what is here: nothing is deleted, newer edits win. A prep-tracker
          export works too.
        </p>
        {message && <p className={message.kind}>{message.text}</p>}
      </section>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Options />
  </StrictMode>,
);
