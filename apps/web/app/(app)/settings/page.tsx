import { loadSnapshot } from "@/lib/data";
import { SettingsForms } from "./SettingsForms";

export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const { viewer, snap } = await loadSnapshot();
  return (
    <>
      <div className="page-head">
        <h1>Settings</h1>
        <span className="muted small">
          Shared with the extension: changes here reach it on its next sync.
        </span>
      </div>
      <section className="card" aria-labelledby="account">
        <h2 id="account">Account</h2>
        <p style={{ margin: 0 }}>
          {viewer.demo ? (
            "Demo account (no sign-in)."
          ) : (
            <>
              Signed in with GitHub as <strong>{viewer.name}</strong>.
            </>
          )}
        </p>
        <p className="muted small">
          To connect the extension, open its settings and click Sign in.
        </p>
      </section>
      <section className="card" aria-labelledby="github">
        <h2 id="github">GitHub</h2>
        {snap.settings.github ? (
          <p style={{ margin: 0 }}>
            The extension commits your Accepted solutions to{" "}
            <a
              href={`https://github.com/${snap.settings.github.owner}/${snap.settings.github.repo}`}
              target="_blank"
              rel="noreferrer"
            >
              {snap.settings.github.owner}/{snap.settings.github.repo}
            </a>{" "}
            ({snap.settings.github.branch}), with notes{" "}
            {snap.settings.github.includeNotes ? "included" : "left out"}.
          </p>
        ) : (
          <p className="muted" style={{ margin: 0 }}>
            Not set up. To commit each Accepted solution to a repo of yours, connect GitHub in the
            extension&apos;s settings.
          </p>
        )}
        <p className="muted small">
          The GitHub sign-in stays in the extension; this site never sees it.
        </p>
      </section>
      <SettingsForms settings={snap.settings} />
    </>
  );
}
