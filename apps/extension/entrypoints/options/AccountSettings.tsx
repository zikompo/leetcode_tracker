import { useEffect, useState } from "react";
import { browser } from "wxt/browser";
import type { SyncStatus } from "@/lib/account";
import { formatAgo } from "@/lib/format";
import { call } from "@/lib/messaging";

/** Sign-in and sync state (spec 9.3). Sign-in happens in Chrome's own GitHub sign-in window. */
export function AccountSettings() {
  const [status, setStatus] = useState<SyncStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = () =>
      void call("getSyncStatus")
        .then(setStatus)
        .catch(() => {});
    load();
    // Sync runs in the background; keep the status line current.
    const timer = setInterval(load, 3000);
    return () => clearInterval(timer);
  }, []);

  const act = async (fn: () => Promise<SyncStatus>) => {
    setBusy(true);
    setError(null);
    try {
      setStatus(await fn());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  if (!status) return null;
  return (
    <section className="card" aria-labelledby="account-heading">
      <h2 id="account-heading">Account and sync</h2>
      {!status.configured ? (
        <p className="muted">
          Accounts aren&apos;t set up in this build. LeetTrack keeps working offline; to sync with
          the website, follow <code>docs/supabase-setup.md</code> and rebuild.
        </p>
      ) : !status.signedIn ? (
        <>
          <p className="muted">
            Sign in to back up your attempts and see them on the LeetTrack website. Everything
            you&apos;ve logged so far is uploaded when you sign in.
          </p>
          <button
            className="btn btn-primary"
            disabled={busy}
            onClick={() => void act(() => call("signInWithGitHub"))}
          >
            {busy ? "Signing in…" : "Sign in with GitHub"}
          </button>
        </>
      ) : (
        <>
          <p className="account-line">
            {status.avatarUrl && <img src={status.avatarUrl} alt="" />}
            <span>
              Signed in as <strong>{status.userName ?? "you"}</strong>
            </span>
          </p>
          <p className={status.lastError ? "bad" : "muted"} role="status">
            {status.syncing
              ? "Syncing…"
              : status.lastError
                ? `Last sync failed: ${status.lastError}`
                : status.lastSyncAt
                  ? `Synced ${formatAgo(status.lastSyncAt)}`
                  : "Not synced yet"}
          </p>
          <div className="row">
            <button
              className="btn btn-primary"
              disabled={busy}
              onClick={() => void act(() => call("syncNow"))}
            >
              Sync now
            </button>
            <button
              className="btn"
              onClick={() => void browser.tabs.create({ url: `${status.websiteUrl}/dashboard` })}
            >
              Open website
            </button>
            <button className="btn" disabled={busy} onClick={() => void act(() => call("signOut"))}>
              Sign out
            </button>
          </div>
        </>
      )}
      {error && (
        <p className="bad" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
