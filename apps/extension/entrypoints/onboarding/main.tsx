import { StrictMode, useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import { browser } from "wxt/browser";
import type { Settings } from "@leettrack/core";
import { Logo } from "@/components/Logo";
import { followSystemTheme } from "@/components/theme";
import { ACCOUNT_ENV } from "@/lib/account";
import { call } from "@/lib/messaging";
import type { Stats } from "@/lib/types";
import { AccountSettings } from "../options/AccountSettings";
import { DataSettings } from "../options/DataSettings";
import { InterviewSettings } from "../options/InterviewSettings";
import { PanelSettings } from "../options/PanelSettings";
import { ReviewSettings } from "../options/ReviewSettings";
import "@/components/base.css";
import "../options/options.css";

followSystemTheme();

const STEPS = [
  { id: "lists", title: "What are you working through?" },
  { id: "interview", title: "Is there an interview coming up?" },
  { id: "panel", title: "Where should logging happen?" },
  { id: "import", title: "Bring in past work" },
  { id: "account", title: "Sync and back up (optional)" },
] as const;

/**
 * First run (spec M7): a few choices, each saved as you make it, every one skippable. The same
 * sections as the settings page, one at a time.
 */
function Onboarding() {
  const [step, setStep] = useState(0);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const refresh = async () => {
    setSettings(await call("getSettings"));
    setStats(await call("getStats"));
  };
  useEffect(() => {
    void refresh();
  }, []);
  const current = STEPS[step]!;
  const last = step === STEPS.length - 1;

  return (
    <main className="options">
      <header className="stack">
        <h1>
          <Logo className="size-7" /> Welcome to LeetTrack
        </h1>
        <p className="muted">
          It logs your LeetCode attempts, schedules reviews before you forget, and tracks which
          patterns you can spot cold. A minute of setup; you can change all of it later in Settings.
        </p>
        <ol className="flex gap-1.5" aria-label="Steps">
          {STEPS.map((s, i) => (
            <li
              key={s.id}
              aria-current={i === step ? "step" : undefined}
              className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-muted"}`}
              title={s.title}
            />
          ))}
        </ol>
        <p className="small muted">
          Step {step + 1} of {STEPS.length}:{" "}
          <strong className="text-foreground">{current.title}</strong>
        </p>
      </header>

      {current.id === "lists" && settings && (
        <ReviewSettings settings={settings} onChange={setSettings} />
      )}
      {current.id === "interview" && settings && (
        <InterviewSettings settings={settings} onChange={setSettings} />
      )}
      {current.id === "panel" && <PanelSettings settings={settings} onChange={setSettings} />}
      {current.id === "import" && (
        <DataSettings
          stats={stats}
          onImported={() => void refresh()}
          title="Import a LeetTrack export or your prep tracker"
          exportable={false}
        />
      )}
      {current.id === "account" && (
        <>
          <AccountSettings />
          <p className="small muted">
            Committing solutions to GitHub and AI complexity suggestions are in Settings whenever
            you want them.{" "}
            <a href={`${ACCOUNT_ENV.websiteUrl}/privacy`} target="_blank" rel="noreferrer">
              Privacy policy
            </a>
          </p>
        </>
      )}

      <div className="row spread">
        <button className="btn" disabled={step === 0} onClick={() => setStep((s) => s - 1)}>
          Back
        </button>
        <div className="row">
          {!last && (
            <button className="btn" onClick={() => setStep((s) => s + 1)}>
              Skip
            </button>
          )}
          <button
            className="btn btn-primary"
            onClick={() => {
              if (!last) return setStep((s) => s + 1);
              location.href = "https://leetcode.com/problemset/";
            }}
          >
            {last ? "Start solving" : "Next"}
          </button>
        </div>
      </div>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Onboarding />
  </StrictMode>,
);
