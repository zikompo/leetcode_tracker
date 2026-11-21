import { StrictMode, useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import type { Settings } from "@leettrack/core";
import { call } from "@/lib/messaging";
import type { Stats } from "@/lib/types";
import { AccountSettings } from "./AccountSettings";
import { GitHubSettings } from "./GitHubSettings";
import { AiSettings } from "./AiSettings";
import { DataSettings } from "./DataSettings";
import { PanelSettings } from "./PanelSettings";
import { PatternSettings } from "./PatternSettings";
import { InterviewSettings } from "./InterviewSettings";
import { ReviewSettings } from "./ReviewSettings";
import { Logo } from "@/components/Logo";
import { ACCOUNT_ENV } from "@/lib/account";
import { openWebsite } from "@/lib/website";
import { followSystemTheme } from "@/components/theme";
import "@/components/base.css";
import "./options.css";

followSystemTheme();

function Options() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);

  const refresh = async () => {
    setSettings(await call("getSettings"));
    setStats(await call("getStats"));
  };
  useEffect(() => {
    void refresh();
  }, []);

  return (
    <main className="options">
      <header className="row spread">
        <h1>
          <Logo className="size-7" /> LeetTrack settings
        </h1>
        <button className="btn" onClick={() => openWebsite()}>
          Open dashboard
        </button>
      </header>

      <PanelSettings settings={settings} onChange={setSettings} />

      <AccountSettings />

      {settings && <ReviewSettings settings={settings} onChange={setSettings} />}
      {settings && <InterviewSettings settings={settings} onChange={setSettings} />}
      {settings && <PatternSettings settings={settings} onDone={() => void refresh()} />}

      <GitHubSettings />

      <AiSettings />

      <DataSettings stats={stats} onImported={() => void refresh()} />

      <p className="muted small">
        <a href={`${ACCOUNT_ENV.websiteUrl}/privacy`} target="_blank" rel="noreferrer">
          Privacy policy
        </a>
      </p>
    </main>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <Options />
  </StrictMode>,
);
