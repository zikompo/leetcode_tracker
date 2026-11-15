import { StrictMode, useEffect, useRef, useState } from "react";
import ReactDOM from "react-dom/client";
import type { PanelAutoOpen, Settings } from "@leettrack/core";
import { call } from "@/lib/messaging";
import type { Stats } from "@/lib/types";
import { AccountSettings } from "./AccountSettings";
import { AiSettings } from "./AiSettings";
import { ReviewSettings } from "./ReviewSettings";
import { browser } from "wxt/browser";
import "@/components/base.css";
import "./options.css";

const AUTO_OPEN: Array<[PanelAutoOpen, string, string]> = [
  ["accepted", "On Accepted", "Open the log panel when a submission is accepted."],
  ["every_submission", "On every submission", "Open it after any result, including Wrong Answer."],
  ["manual", "Only manually", "Open it yourself from the floating button or the toolbar."],
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
        text: `Imported: ${r.attemptsAdded} new attempts, ${r.attemptsUpdated} updated, ${r.problemsMerged} problems merged.`,
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
        <h1>LeetTrack settings</h1>
        <button
          className="btn"
          onClick={() =>
            void browser.tabs.create({ url: browser.runtime.getURL("/dashboard.html") })
          }
        >
          Open dashboard
        </button>
      </header>

      <section className="card">
        <h2>When should the log panel open?</h2>
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
                <strong>{label}</strong>
                <span className="muted">{hint}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <AccountSettings />

      {settings && <ReviewSettings settings={settings} onChange={setSettings} />}

      <AiSettings />

      <section className="card">
        <h2>Your data</h2>
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
          Importing merges with what is here: nothing is deleted, newer edits win.
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
