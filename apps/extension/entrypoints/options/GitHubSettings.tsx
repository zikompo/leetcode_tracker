import { useCallback, useEffect, useState } from "react";
import { browser } from "wxt/browser";
import { formatAgo } from "@/lib/format";
import type { RepoChoice } from "@/lib/github/api";
import { GITHUB_ORIGINS } from "@/lib/github/chrome";
import type { GitHubStatus } from "@/lib/github/service";
import { call } from "@/lib/messaging";

/** Commit Accepted solutions to a GitHub repo (spec 8). */
export function GitHubSettings() {
  const [status, setStatus] = useState<GitHubStatus | null>(null);
  const [repos, setRepos] = useState<RepoChoice[] | null>(null);
  const [choosing, setChoosing] = useState(false);
  const [backlog, setBacklog] = useState(0);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ kind: "ok" | "bad"; text: string } | null>(null);

  const refresh = useCallback(async () => {
    const s = await call("githubStatus");
    setStatus(s);
    if (s.connected && s.target) setBacklog(await call("githubBackfillCount"));
    return s;
  }, []);

  useEffect(() => {
    void refresh().catch(() => {});
    const t = setInterval(() => void refresh().catch(() => {}), 5000);
    return () => clearInterval(t);
  }, [refresh]);

  // While a code is showing, ask GitHub whether it's been approved yet.
  const waiting = Boolean(status?.deviceCode) && !status?.connected;
  useEffect(() => {
    if (!waiting) return;
    let delay = 5000;
    let timer: ReturnType<typeof setTimeout>;
    const tick = async () => {
      try {
        const s = await call("githubPollConnect");
        setStatus(s);
        if (s.connected) return;
        if (s.interval) delay = s.interval * 1000;
      } catch (e) {
        setMessage({ kind: "bad", text: e instanceof Error ? e.message : String(e) });
        await refresh();
        return;
      }
      timer = setTimeout(() => void tick(), delay);
    };
    timer = setTimeout(() => void tick(), 1000);
    return () => clearTimeout(timer);
  }, [waiting, refresh]);

  const run = async (fn: () => Promise<unknown>, ok?: string) => {
    setBusy(true);
    setMessage(null);
    try {
      await fn();
      if (ok) setMessage({ kind: "ok", text: ok });
    } catch (e) {
      setMessage({ kind: "bad", text: e instanceof Error ? e.message : String(e) });
    } finally {
      setBusy(false);
      await refresh().catch(() => {});
    }
  };

  const connect = () => {
    // Ask for access first, while the click still counts as the user's.
    const granted = GITHUB_ORIGINS.length
      ? browser.permissions.request({ origins: GITHUB_ORIGINS }).catch(() => false)
      : Promise.resolve(true);
    void run(async () => {
      await granted;
      setStatus(await call("githubStartConnect"));
    });
  };

  const loadRepos = () =>
    run(async () => {
      setRepos(await call("githubListRepos"));
      setChoosing(true);
    });

  // Once connected without a repo, list the repos straight away; if the App is installed on
  // just one, use it. Saves a step people tend to miss.
  const needsRepo = Boolean(status?.connected && !status.target);
  useEffect(() => {
    if (!needsRepo || repos !== null || busy) return;
    void run(async () => {
      const list = await call("githubListRepos");
      setRepos(list);
      if (list.length === 1) {
        const [r] = list;
        await call("githubSelectRepo", {
          owner: r!.owner,
          repo: r!.repo,
          branch: r!.defaultBranch,
        });
        void call("githubRetryNow"); // commit anything saved while no repo was chosen
        setMessage({ kind: "ok", text: `Committing to ${r!.owner}/${r!.repo}.` });
      } else {
        setChoosing(true);
      }
    });
  }, [needsRepo, repos, busy]);

  if (!status) return null;
  const s = status;
  return (
    <section className="card" aria-labelledby="github-heading">
      <h2 id="github-heading">GitHub</h2>

      {!s.configured ? (
        <p className="muted">
          GitHub sync isn&apos;t set up in this build. To commit your Accepted solutions to a repo,
          follow <code>docs/github-setup.md</code> and rebuild.
        </p>
      ) : s.deviceCode && !s.connected ? (
        <div className="stack">
          <p>Enter this code on GitHub to let LeetTrack commit to the repo you choose:</p>
          <p className="device-code" aria-label="GitHub code">
            {s.deviceCode.userCode}
          </p>
          <div className="row">
            <button
              className="btn"
              onClick={() => void navigator.clipboard.writeText(s.deviceCode!.userCode)}
            >
              Copy code
            </button>
            <a
              className="btn btn-primary"
              href={s.deviceCode.verificationUri}
              target="_blank"
              rel="noreferrer"
            >
              Open GitHub
            </a>
          </div>
          <p className="muted small">Waiting for you to approve on GitHub…</p>
        </div>
      ) : !s.connected ? (
        <div className="stack">
          <p className="muted">
            {s.needsReconnect
              ? "GitHub stopped accepting LeetTrack's sign-in. Connect again to keep committing; nothing queued is lost."
              : "Commit each Accepted solution, with a README of your attempts, to a repo of your choice. LeetTrack can only write to repos you install its GitHub app on."}
          </p>
          <div className="row">
            <button className="btn btn-primary" disabled={busy} onClick={connect}>
              {s.needsReconnect ? "Reconnect GitHub" : "Connect GitHub"}
            </button>
          </div>
        </div>
      ) : !s.target || choosing ? (
        <div className="stack">
          <p className="muted">Connected as {s.login}. Pick the repo to commit to.</p>
          {repos === null ? (
            <button className="btn btn-primary" disabled={busy} onClick={() => void loadRepos()}>
              Choose a repo
            </button>
          ) : repos.length === 0 ? (
            <>
              <p>
                The LeetTrack app isn&apos;t installed on any repo yet.{" "}
                {s.installUrl && (
                  <a href={s.installUrl} target="_blank" rel="noreferrer">
                    Install it on your solutions repo
                  </a>
                )}
                , then come back.
              </p>
              <button className="btn" disabled={busy} onClick={() => void loadRepos()}>
                I&apos;ve installed it
              </button>
            </>
          ) : (
            <ul className="repo-list">
              {repos.map((r) => (
                <li key={`${r.owner}/${r.repo}`}>
                  <button
                    className="btn"
                    disabled={busy}
                    onClick={() =>
                      void run(async () => {
                        await call("githubSelectRepo", {
                          owner: r.owner,
                          repo: r.repo,
                          branch: r.defaultBranch,
                        });
                        setChoosing(false);
                        void call("githubRetryNow");
                      }, `Committing to ${r.owner}/${r.repo}.`)
                    }
                  >
                    {r.owner}/{r.repo}
                  </button>
                  <span className="muted small">
                    {r.defaultBranch}
                    {r.private ? " · private" : " · public"}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="stack">
          <p>
            Committing Accepted solutions to{" "}
            <a
              href={`https://github.com/${s.target.owner}/${s.target.repo}`}
              target="_blank"
              rel="noreferrer"
            >
              <strong>
                {s.target.owner}/{s.target.repo}
              </strong>
            </a>{" "}
            ({s.target.branch}) as {s.login}.
          </p>
          <p className={s.lastError && s.pending ? "bad small" : "muted small"} role="status">
            {s.pending > 0
              ? `${s.pending} waiting to commit${s.lastError ? `: ${s.lastError}` : ""}`
              : s.lastCommitAt
                ? `Last commit ${formatAgo(s.lastCommitAt)}`
                : "Nothing committed yet: your next Accepted solution will be."}
          </p>
          <label className="check">
            <input
              type="checkbox"
              checked={s.target.includeNotes}
              disabled={busy}
              onChange={(e) => void run(() => call("githubSetIncludeNotes", e.target.checked))}
            />
            Include my notes in each problem&apos;s README
          </label>
          <div className="row">
            {backlog > 0 && (
              <button
                className="btn btn-primary"
                disabled={busy}
                onClick={() =>
                  void run(
                    () => call("githubBackfill"),
                    `Committing ${backlog} past solutions in the background.`,
                  )
                }
              >
                Commit past solutions ({backlog})
              </button>
            )}
            {s.pending > 0 && (
              <button
                className="btn"
                disabled={busy}
                onClick={() => void run(() => call("githubRetryNow"))}
              >
                Retry now
              </button>
            )}
            <button className="btn" disabled={busy} onClick={() => void loadRepos()}>
              Change repo
            </button>
            <button
              className="btn"
              disabled={busy}
              onClick={() => void run(() => call("githubDisconnect"))}
            >
              Disconnect
            </button>
          </div>
        </div>
      )}
      {message && <p className={message.kind}>{message.text}</p>}
    </section>
  );
}
